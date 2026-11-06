(() => {
  'use strict';
  const KEY = 'parkfind.savedParkingSpot.v1';
  const RECENTS_KEY = 'parkfind.recentSpots.v1';
  const NAME_KEY = 'parkfind.guestName.v1';
  const $ = (id) => document.getElementById(id);
  const ui = {
    map: $('map'), title: $('saved-title'), savedDetails: $('saved-details'), savedTime: $('saved-time'),
    currentDetails: $('current-details'), accuracy: $('accuracy'), status: $('status'), distance: $('distance-details'),
    save: $('save-button'), saveLabel: $('save-label'), choose: $('choose-button'), locate: $('locate-button'),
    sheetToggle: $('sheet-toggle'), routeContent: $('route-content'), routeCard: $('route-card'),
    maps: $('maps-link'), clear: $('clear-button'), hint: $('map-hint'), locationLabel: $('map-location-label'), toast: $('toast'), nameInput: $('name-input'),
    startGuidance: $('start-guidance'), guidanceButtonLabel: $('guidance-button-label'), guidanceCard: $('guidance-card'), guidanceArrow: $('guidance-arrow'),
    guidanceTitle: $('guidance-title'), guidanceDetail: $('guidance-detail'), guidanceNote: $('guidance-note'), stopGuidance: $('stop-guidance')
  };
  let current = null, saved = readSaved(), recents = readRecents(), guestName = readName(), selected = null, selecting = false;
  let map = null, currentMarker = null, parkingMarker = null, routeLine = null, locationWatch = null, toastTimer = null;
  let guidanceActive = false, didInitialFrame = false, routeRequest = 0, lastRouteRequestAt = 0, currentRoute = null, routeController = null, guidanceStepIndex = 0;

  function readSaved() { try { const p = JSON.parse(localStorage.getItem(KEY)); return p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) ? p : null; } catch (_) { return null; } }
  function readRecents() { try { const list = JSON.parse(localStorage.getItem(RECENTS_KEY)); return Array.isArray(list) ? list.filter(validPoint).slice(0, 10) : []; } catch (_) { return []; } }
  function readName() { try { return (localStorage.getItem(NAME_KEY) || '').trim().slice(0, 32); } catch (_) { return ''; } }
  function validPoint(p) { return p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180; }
  function setStatus(message, tone = '') { ui.status.textContent = message; ui.status.dataset.tone = tone; }
  function showToast(message) { ui.toast.textContent = message; ui.toast.classList.add('show'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => ui.toast.classList.remove('show'), 2500); }
  function format(p) { return `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`; }
  function destination() { return selected || saved; }
  function distanceMeters(a, b) { const rad = n => n * Math.PI / 180; const dLat = rad(b.latitude-a.latitude), dLon = rad(b.longitude-a.longitude); const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2; return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)); }
  function bearingDegrees(a,b) { const rad=n=>n*Math.PI/180, lat1=rad(a.latitude),lat2=rad(b.latitude),dLon=rad(b.longitude-a.longitude); const y=Math.sin(dLon)*Math.cos(lat2),x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon); return (Math.atan2(y,x)*180/Math.PI+360)%360; }
  function compassDirection(d) { return ['north','northeast','east','southeast','south','southwest','west','northwest'][Math.round(d/45)%8]; }
  function formatDistance(meters) { return meters < 1000 ? `${Math.max(0,Math.round(meters/10)*10)} m` : `${(meters/1000).toFixed(1)} km`; }
  function formatDuration(seconds) { const minutes=Math.max(1,Math.round(seconds/60));return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} hr ${minutes%60?`${minutes%60} min`:''}`.trim(); }
  function stepLocation(step) { const coords=step&&step.maneuver&&step.maneuver.location;return Array.isArray(coords)&&Number.isFinite(coords[0])&&Number.isFinite(coords[1])?{longitude:coords[0],latitude:coords[1]}:null; }
  function stepInstruction(step) {
    const maneuver=step.maneuver||{},type=maneuver.type||'continue',modifier=maneuver.modifier||'straight',road=step.name?` onto ${step.name}`:'';
    if(type==='arrive')return 'Arrive at your parking spot';
    if(type==='depart')return `Head ${modifier}${road?` on ${step.name}`:''}`;
    if(type==='roundabout'||type==='rotary')return `At the roundabout, take exit ${maneuver.exit||'ahead'}${road}`;
    if(type==='fork')return `Keep ${modifier} at the fork${road}`;
    if(type==='merge')return `Merge ${modifier}${road}`;
    if(type==='end of road')return `At the end of the road, turn ${modifier}${road}`;
    if(type==='on ramp')return `Take the ramp${road}`;
    if(type==='off ramp')return `Take the exit${road}`;
    if(type==='exit roundabout')return `Exit the roundabout${road}`;
    if(type==='new name')return `Continue${road||' ahead'}`;
    if(type==='turn'||type==='continue'||type==='notification')return `${type==='turn'?'Turn':'Continue'} ${modifier}${road}`;
    return `Continue${road||' toward your parking spot'}`;
  }
  function googleMapsUrl(p) { return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(format(p))}&travelmode=walking`; }

  function loadLeaflet() {
    const hosts=['https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet','https://unpkg.com/leaflet@1.9.4/dist/leaflet']; let i=0,done=false;
    function next(){ if(i>=hosts.length){ui.map.innerHTML='<div class="map-message"><strong>Map could not load</strong><span>Your saved spot and recent list are still available. Check your connection.</span></div>';setStatus('Map library unavailable. Saved spots are still available.','error');return;} const base=hosts[i++];const css=document.createElement('link');css.rel='stylesheet';css.href=`${base}.css`;document.head.appendChild(css);const s=document.createElement('script');s.src=`${base}.js`;s.async=true;s.onload=()=>{if(!done){done=true;initMap();}};s.onerror=()=>{s.remove();next();};document.head.appendChild(s);}
    next();
  }
  function initMap() {
    if(!window.L||map)return;ui.map.innerHTML='';map=L.map(ui.map,{zoomControl:false,scrollWheelZoom:false,touchZoom:true,dragging:true,tap:true,minZoom:2,maxZoom:19}).setView([20,0],2);L.control.zoom({position:'topright'}).addTo(map);
    const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{minZoom:2,maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);let errors=0;
    tiles.on('tileerror',()=>{if(++errors>=3)setStatus('Map images could not load. Check your connection; route details may still be available.','error');});tiles.on('tileload',()=>{errors=0;});
    map.on('click',e=>{if(!selecting)return;selected={latitude:e.latlng.lat,longitude:e.latlng.lng};currentRoute=null;updateView();setStatus('Spot selected. Tap Save parking spot when ready.','success');showToast('Parking spot selected');});
    updateMarkers();setTimeout(()=>map&&map.invalidateSize(),150);window.addEventListener('resize',()=>map&&map.invalidateSize());
  }
  function markerIcon(kind,text){return L.divIcon({className:'pf-marker-shell',html:`<span class="pf-marker ${kind}">${text}</span>`,iconSize:[36,44],iconAnchor:[18,40]});}
  function updateMarkers(){
    if(!map)return;if(currentMarker)map.removeLayer(currentMarker);if(parkingMarker)map.removeLayer(parkingMarker);if(routeLine)map.removeLayer(routeLine);currentMarker=parkingMarker=routeLine=null;
    if(current)currentMarker=L.marker([current.latitude,current.longitude],{icon:markerIcon('marker-you','●'),title:'You are here',zIndexOffset:500}).addTo(map);
    const end=destination();if(end)parkingMarker=L.marker([end.latitude,end.longitude],{icon:markerIcon('marker-park','P'),title:selected?'Selected parking spot':'Saved parking spot',zIndexOffset:700}).addTo(map);
    if(current&&end){if(currentRoute&&currentRoute.coordinates)routeLine=L.geoJSON(currentRoute,{style:{color:'#1683ff',weight:7,opacity:.94,lineCap:'round',lineJoin:'round'}}).addTo(map);else routeLine=L.polyline([[current.latitude,current.longitude],[end.latitude,end.longitude]],{color:'#1683ff',weight:5,opacity:.8,dashArray:'7 9',lineCap:'round',interactive:false}).addTo(map);}
    if(!didInitialFrame&&(current||end))frameOverview(false);
  }
  function frameOverview(animate=true){if(!map)return;const end=destination(),pts=[current,end].filter(validPoint);if(!pts.length){if(map.getZoom()<14)map.setView([20,0],3,{animate});return;}didInitialFrame=true;if(pts.length>1&&distanceMeters(pts[0],pts[1])>25){map.fitBounds(pts.map(p=>[p.latitude,p.longitude]),{paddingTopLeft:[35,85],paddingBottomRight:[35,Math.min(310,Math.round(innerHeight*.44))],maxZoom:17,animate});}else map.setView([(end||current).latitude,(end||current).longitude],17,{animate});}
  function zoomBy(delta){if(map)map.setZoom(Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),map.getZoom()+delta)),{animate:true});}

  function updateGuidanceProgress(){
    if(!guidanceActive||!current||!currentRoute||!currentRoute.steps.length)return;
    const steps=currentRoute.steps;
    while(guidanceStepIndex<steps.length-1){const next=stepLocation(steps[guidanceStepIndex]);if(!next||distanceMeters(current,next)>22)break;guidanceStepIndex++;}
    const step=steps[guidanceStepIndex],target=stepLocation(step),distanceToStep=target?distanceMeters(current,target):0;
    const maneuver=step.maneuver||{};
    const direction=target&&distanceToStep>5?bearingDegrees(current,target):Number.isFinite(maneuver.bearing_after)?maneuver.bearing_after:bearingDegrees(current,destination());
    ui.guidanceArrow.style.transform=`rotate(${direction}deg)`;
    ui.guidanceTitle.textContent=stepInstruction(step);
    ui.guidanceDetail.textContent=maneuver.type==='arrive'||distanceToStep<12?'At your next point':`${formatDistance(distanceToStep)} ahead`;
    let remainingDistance=0,remainingDuration=0;
    for(let i=guidanceStepIndex;i<steps.length;i++){
      const item=steps[i],fraction=i===guidanceStepIndex&&item.distance>0?Math.min(1,distanceToStep/item.distance):1;
      remainingDistance+=(Number(item.distance)||0)*fraction;
      remainingDuration+=(Number(item.duration)||0)*fraction;
    }
    ui.guidanceNote.textContent=`${formatDistance(remainingDistance)} remaining · ${formatDuration(remainingDuration)}`;
  }
  async function fetchWalkingRoute(){
    if(!current||!destination())return;
    if(routeController)routeController.abort();
    const start=current,end=destination(),seq=++routeRequest,controller=new AbortController();routeController=controller;lastRouteRequestAt=Date.now();
    let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},12000);
    const url=`https://routing.openstreetmap.de/routed-foot/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`;
    try{
      const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(`Walking route service returned ${response.status}`);
      const data=await response.json(),route=data.routes&&data.routes[0],steps=route&&Array.isArray(route.legs)?route.legs.flatMap(leg=>Array.isArray(leg.steps)?leg.steps:[]):[];
      if(seq!==routeRequest)return;
      if(!route||!route.geometry||!Array.isArray(route.geometry.coordinates)||!steps.length)throw new Error('Walking route response did not contain turn-by-turn steps');
      currentRoute={...route.geometry,summary:route.summary,steps};guidanceStepIndex=0;updateMarkers();updateGuidanceProgress();
    }catch(error){
      if(seq===routeRequest&&(timedOut||!controller.signal.aborted)){currentRoute=null;if(guidanceActive){ui.guidanceNote.textContent=timedOut?'Walking route request timed out. Check your connection and try again.':'Walking directions are unavailable. Check your connection and try again.';setStatus(ui.guidanceNote.textContent,'error');}updateMarkers();}
    }finally{clearTimeout(timer);if(routeController===controller)routeController=null;}
  }
  function requestRouteThrottled(){
    if(!guidanceActive||!current)return;
    if(!currentRoute){if(Date.now()-lastRouteRequestAt>10000)fetchWalkingRoute();return;}
    if(Date.now()-lastRouteRequestAt<10000)return;
    const coordinates=currentRoute.coordinates||[];let nearest=Infinity;
    for(let i=0;i<coordinates.length;i+=Math.max(1,Math.floor(coordinates.length/250)))nearest=Math.min(nearest,distanceMeters(current,{longitude:coordinates[i][0],latitude:coordinates[i][1]}));
    if(nearest>55)fetchWalkingRoute();
  }

  function updateCard(){
    const end=destination();ui.title.textContent=selected?'Spot selected':saved?'Spot saved':'Not saved yet';
    if(end){ui.savedDetails.textContent=format(end);ui.savedTime.hidden=!saved||!!selected;if(saved&&!selected)ui.savedTime.textContent=`Saved ${new Date(saved.savedAt).toLocaleString()}`;ui.clear.hidden=!saved;ui.maps.href=googleMapsUrl(end);ui.maps.setAttribute('aria-disabled','false');ui.saveLabel.textContent=selected?'Save selected parking spot':saved?'Update parking spot':'Save parking spot';ui.startGuidance.disabled=!current;
      if(current){const m=distanceMeters(current,end);ui.distance.textContent=m<1000?`${Math.round(m)} m away`:`${(m/1000).toFixed(1)} km away`;ui.currentDetails.textContent=`From your current location · ±${current.accuracy?Math.round(current.accuracy)+' m':'GPS'}`;}else{ui.distance.textContent='Your spot is ready';ui.currentDetails.textContent='Waiting for current location…';}
    }else{ui.savedDetails.textContent='Save your current location or choose a spot on the map.';ui.savedTime.hidden=true;ui.clear.hidden=true;ui.maps.href='#';ui.maps.setAttribute('aria-disabled','true');ui.saveLabel.textContent='Save parking spot';ui.distance.textContent='Waiting for your location';ui.currentDetails.textContent=current?`You are here · ${format(current)}`:'Waiting for your current location…';ui.startGuidance.disabled=true;}
    ui.locationLabel.textContent=current?'Current location found':saved?'Showing your saved parking spot':'Find your parking spot';ui.guidanceCard.hidden=!guidanceActive;ui.guidanceButtonLabel.textContent=guidanceActive?'Walking…':'Start walking';ui.startGuidance.classList.toggle('is-guiding',guidanceActive);
    if(guidanceActive&&current&&end){if(currentRoute)updateGuidanceProgress();else{const m=distanceMeters(current,end),b=bearingDegrees(current,end);ui.guidanceArrow.style.transform=`rotate(${b}deg)`;ui.guidanceTitle.textContent=m<15?'You’re at your parking spot':`Head ${compassDirection(b)}`;ui.guidanceDetail.textContent=`${formatDistance(m)} straight-line distance`;ui.guidanceNote.textContent='Getting a walking path…';}}
  }
  function updateRecents(){const host=$('recent-list'),empty=$('empty-recents'),clear=$('clear-recents');host.innerHTML='';empty.hidden=recents.length>0;clear.hidden=recents.length===0;recents.forEach((spot,index)=>{const item=document.createElement('button');item.type='button';item.className='recent-item';item.setAttribute('data-recent-index',String(index));const pin=document.createElement('span');pin.className='recent-pin';pin.textContent='P';const text=document.createElement('span');text.className='recent-text';const title=document.createElement('strong');title.textContent=spot.label||`Parking spot${index===0?' · Latest':''}`;const detail=document.createElement('small');detail.textContent=`${new Date(spot.savedAt).toLocaleString()} · ${spot.latitude.toFixed(5)}, ${spot.longitude.toFixed(5)}`;text.append(title,detail);const arrow=document.createElement('span');arrow.className='recent-arrow';arrow.textContent='›';item.append(pin,text,arrow);host.appendChild(item);});}
  function updateProfile(){const display=guestName||'Guest',initials=guestName?guestName.split(/\s+/).slice(0,2).map(p=>p.charAt(0)).join('').toUpperCase():'G';$('profile-avatar').textContent=initials;$('profile-avatar').setAttribute('aria-label',`${display} profile image`);$('account-title').textContent=display;$('account-subtitle').textContent=guestName?'Guest profile · saved on this device':'You’re using ParkFind without an account.';$('home-name').textContent=guestName?`, ${guestName}`:'';if(ui.nameInput&&document.activeElement!==ui.nameInput)ui.nameInput.value=guestName;}
  function updateView(){updateCard();updateMarkers();updateProfile();updateRecents();}
  function setTab(tab){document.querySelectorAll('.app-view').forEach(v=>{const show=v.id===`${tab}-view`;v.hidden=!show;v.classList.toggle('is-visible',show);});document.querySelectorAll('.nav-item').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('is-active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});if(tab==='map')setTimeout(()=>map&&map.invalidateSize(),100);}
  const swipeTabs=['map','home','recents','account'];
  document.querySelectorAll('.content-view').forEach(view=>{
    let start=null;
    view.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'||!event.isPrimary||event.target.closest('button,a,input,textarea,select,[contenteditable="true"]'))return;
      start={id:event.pointerId,x:event.clientX,y:event.clientY};
    });
    view.addEventListener('pointerup',event=>{
      if(!start||start.id!==event.pointerId)return;
      const dx=event.clientX-start.x,dy=event.clientY-start.y;start=null;
      if(Math.abs(dx)<64||Math.abs(dx)<Math.abs(dy)*1.3)return;
      const active=document.querySelector('.nav-item[aria-current="page"]')?.dataset.tab,index=swipeTabs.indexOf(active);
      if(index<0)return;
      const next=swipeTabs[index+(dx<0?1:-1)];
      if(next)setTab(next);
    });
    view.addEventListener('pointercancel',()=>{start=null;});
  });
  function setSheetExpanded(expanded){ui.sheetToggle.setAttribute('aria-expanded',String(expanded));ui.sheetToggle.setAttribute('aria-label',`${expanded?'Collapse':'Expand'} parking details`);ui.routeContent.hidden=!expanded;ui.routeCard.classList.toggle('is-collapsed',!expanded);if(map)setTimeout(()=>map.invalidateSize(),300);}
  let sheetPointerStart=null,suppressSheetClick=false;
  ui.sheetToggle.addEventListener('pointerdown',event=>{if(!event.isPrimary)return;sheetPointerStart={id:event.pointerId,y:event.clientY};suppressSheetClick=false;ui.sheetToggle.setPointerCapture(event.pointerId);});
  ui.sheetToggle.addEventListener('pointerup',event=>{if(!sheetPointerStart||sheetPointerStart.id!==event.pointerId)return;const delta=event.clientY-sheetPointerStart.y;sheetPointerStart=null;if(Math.abs(delta)<36)return;suppressSheetClick=true;window.setTimeout(()=>{suppressSheetClick=false;},400);setSheetExpanded(delta<0);});
  ui.sheetToggle.addEventListener('pointercancel',()=>{sheetPointerStart=null;});
  ui.sheetToggle.addEventListener('click',event=>{if(suppressSheetClick){suppressSheetClick=false;event.preventDefault();return;}setSheetExpanded(ui.sheetToggle.getAttribute('aria-expanded')!=='true');});
  function onPosition(position){current={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy};updateView();if(!guidanceActive)setStatus('Location updated just now.','success');else{if(map&&distanceMeters({latitude:map.getCenter().lat,longitude:map.getCenter().lng},current)>20)map.setView([current.latitude,current.longitude],Math.max(map.getZoom(),17),{animate:true});setStatus('Walking navigation is active. Keep this page open.','success');}requestRouteThrottled();}
  function onLocationError(error){const m={1:'Location permission is off. Enable it in browser settings or choose a spot on the map.',2:'Location is unavailable right now. Try again or choose a spot on the map.',3:'Location request timed out. Tap the location button to retry.'};setStatus(m[error.code]||'Could not get your location.','error');if(guidanceActive)stopGuidance('Location lost. Walking navigation paused.');ui.locationLabel.textContent=saved?'Showing your saved parking spot':'Location unavailable';}
  function locate(){if(!navigator.geolocation){setStatus('Location is not supported. Choose a spot on the map instead.','error');return;}if(!window.isSecureContext){setStatus('GPS needs HTTPS. You can still select a map spot.','error');return;}setStatus('Finding your current location…');navigator.geolocation.getCurrentPosition(onPosition,onLocationError,{enableHighAccuracy:true,timeout:20000,maximumAge:0});}
  function startGuidance(){if(!saved&&!selected){showToast('Save a parking spot first.');return;}if(!current){setStatus('Waiting for GPS before starting walking navigation.','error');locate();return;}if(!navigator.geolocation||!navigator.geolocation.watchPosition){setStatus('Live location is unavailable in this browser.','error');return;}guidanceActive=true;guidanceStepIndex=0;if(locationWatch!==null)navigator.geolocation.clearWatch(locationWatch);locationWatch=navigator.geolocation.watchPosition(onPosition,onLocationError,{enableHighAccuracy:true,timeout:20000,maximumAge:3000});updateView();if(map)map.setView([current.latitude,current.longitude],Math.max(map.getZoom(),17),{animate:true});fetchWalkingRoute();setStatus('Walking navigation started. Keep this page open.','success');showToast('Walking route started');}
  function stopGuidance(message='Walking navigation stopped.'){guidanceActive=false;if(locationWatch!==null&&navigator.geolocation)navigator.geolocation.clearWatch(locationWatch);locationWatch=null;routeRequest++;if(routeController){routeController.abort();routeController=null;}updateView();if(map)frameOverview(true);setStatus(message);}
  function saveSpot(point){const spot={latitude:point.latitude,longitude:point.longitude,savedAt:new Date().toISOString()};saved=spot;recents=[spot,...recents.filter(r=>Math.abs(r.latitude-spot.latitude)>0.00005||Math.abs(r.longitude-spot.longitude)>0.00005)].slice(0,10);try{localStorage.setItem(KEY,JSON.stringify(saved));localStorage.setItem(RECENTS_KEY,JSON.stringify(recents));}catch(_){setStatus('Could not save this spot. Check browser storage settings.','error');return false;}return true;}

  ui.save.addEventListener('click',()=>{const p=selected||current;if(!p){setStatus('Waiting for GPS. Enable location or choose a spot on the map.','error');locate();return;}if(!saveSpot(p))return;selected=null;selecting=false;ui.choose.setAttribute('aria-pressed','false');ui.choose.textContent='Choose a different spot on the map';didInitialFrame=true;currentRoute=null;updateView();setStatus('Parking spot saved on this device.','success');showToast('Parking spot saved');if(current)fetchWalkingRoute();});
  ui.choose.addEventListener('click',()=>{selecting=!selecting;ui.choose.setAttribute('aria-pressed',String(selecting));if(selecting){selected=current?{latitude:current.latitude,longitude:current.longitude}:saved?{latitude:saved.latitude,longitude:saved.longitude}:null;ui.choose.textContent='Cancel choosing a spot';ui.hint.textContent='Tap the map to move the parking marker.';setStatus('Tap the map to place your parking marker.','success');if(selected&&map)map.setView([selected.latitude,selected.longitude],18,{animate:true});}else{selected=null;ui.choose.textContent='Choose a different spot on the map';ui.hint.textContent='Drag to explore, pinch to zoom, or choose a spot manually.';setStatus('Map selection cancelled.');}updateView();});
  ui.startGuidance.addEventListener('click',()=>guidanceActive?stopGuidance():startGuidance());ui.stopGuidance.addEventListener('click',()=>stopGuidance());ui.maps.addEventListener('click',e=>{if(!saved&&!selected)e.preventDefault();});ui.locate.addEventListener('click',()=>{if(guidanceActive&&current&&map)map.setView([current.latitude,current.longitude],Math.max(map.getZoom(),17),{animate:true});else frameOverview(true);});
  ui.clear.addEventListener('click',()=>{try{localStorage.removeItem(KEY);}catch(_){}saved=null;recents=recents.slice(1);try{localStorage.setItem(RECENTS_KEY,JSON.stringify(recents));}catch(_){}currentRoute=null;stopGuidance('Saved spot forgotten.');showToast('Saved spot removed');});
  $('recent-list').addEventListener('click',e=>{const button=e.target.closest('[data-recent-index]');if(!button)return;const spot=recents[Number(button.dataset.recentIndex)];if(!spot)return;saved={...spot};try{localStorage.setItem(KEY,JSON.stringify(saved));}catch(_){}selected=null;currentRoute=null;updateView();setTab('map');if(map)frameOverview(true);setStatus('Recent parking spot loaded.','success');});
  $('clear-recents').addEventListener('click',()=>{recents=[];try{localStorage.removeItem(RECENTS_KEY);}catch(_){}updateRecents();showToast('Recent spots cleared');});
  $('save-name-button').addEventListener('click',()=>{guestName=(ui.nameInput.value||'').trim().slice(0,32);try{if(guestName)localStorage.setItem(NAME_KEY,guestName);else localStorage.removeItem(NAME_KEY);}catch(_){showToast('Could not save your name');return;}updateProfile();showToast(guestName?`Welcome, ${guestName}!`:'Name cleared');});
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));document.querySelectorAll('[data-open-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.openTab)));document.querySelectorAll('[data-tab-link]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();setTab(a.dataset.tabLink);}));
  updateView();setTab('map');loadLeaflet();locate();
})();
