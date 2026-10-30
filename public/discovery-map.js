import {validMapPoint,BRAZIL_BOUNDS,discoveryCircle} from './discovery-data.js';

let map=null,viewport=null,engine=null,generation=0,options=null,overlays=[],sdk=null,circleSource=null;
async function loadEngine(){
 if(engine)return engine;
 if(!document.querySelector('[data-prospecto-map-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/maps/engine.css';css.dataset.prospectoMapCss='';document.head.append(css);}
 engine=import('/vendor/maps/engine.js').catch(error=>{engine=null;throw error;});return engine;
}
export function suspendDiscoveryMap(){if(map)map.getTargetElement()?.remove();}
export function destroyDiscoveryMap(){
 generation++;
 if(map){const [lon,lat]=sdk.ol.proj.toLonLat(map.getView().getCenter());viewport={lat,lon,zoom:map.getView().getZoom()};overlays.forEach(overlay=>map.removeOverlay(overlay));overlays=[];map.dispose();map=null;circleSource=null;}
}
export function discoveryMapCenter(){if(!map)return null;const [lon,lat]=sdk.ol.proj.toLonLat(map.getView().getCenter());return {lat,lon};}
function fitPoints(points,padding,maxZoom){
 if(!map||!points.length)return;
 const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]),extent=sdk.ol.proj.transformExtent([Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],'EPSG:4326','EPSG:3857');
 map.getView().fit(extent,{padding:[padding,padding,padding,padding],maxZoom,duration:0});
}
export function fitDiscoveryResults(items){fitPoints(items.filter(i=>validMapPoint(i.lat,i.lon)).map(i=>[i.lon,i.lat]),45,15);}
function refreshFeatures(){
 if(!map||!options)return;
 const {ol}=sdk;overlays.forEach(overlay=>map.removeOverlay(overlay));overlays=[];
 const center=document.createElement('div');center.className='discovery-map-center';center.setAttribute('aria-hidden','true');
 const add=(element,lat,lon,positioning)=>{const overlay=new ol.Overlay({element,position:ol.proj.fromLonLat([lon,lat]),positioning,stopEvent:true});map.addOverlay(overlay);overlays.push(overlay);};
 add(center,options.area.lat,options.area.lon,'center-center');
 options.items.forEach(item=>{
  if(!validMapPoint(item.lat,item.lon))return;
  const element=document.createElement('button');element.type='button';element.className='discovery-map-marker'+(item.id===options.activeId?' selected':'');element.title=item.name;element.setAttribute('aria-label',item.name);
  const label=document.createElement('span');label.textContent=String(item.mapNumber);element.append(label);
  element.addEventListener('click',event=>{event.stopPropagation();options?.onSelect?.(item);});
  add(element,item.lat,item.lon,'bottom-center');
 });
 circleSource.clear();circleSource.addFeature(new ol.format.GeoJSON().readFeature(discoveryCircle(options.area),{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'}));
}
export async function mountDiscoveryMap(container,nextOptions){
 options=nextOptions;const current=++generation;
 try{
  sdk=await loadEngine();if(current!==generation||!container.isConnected)return;
  const {ol,style}=sdk;
  if(map){container.replaceWith(map.getTargetElement());map.updateSize();}
  else{
   const initial=viewport&&!options.focus?viewport:{...options.area,zoom:13},defaults=typeof ol.interaction.defaults==='function'?ol.interaction.defaults:ol.interaction.defaults.defaults;
   const base=new ol.layer.Group();
   map=new ol.Map({target:container,layers:[base],view:new ol.View({center:ol.proj.fromLonLat([initial.lon,initial.lat]),zoom:initial.zoom,minZoom:3,maxZoom:19,extent:ol.proj.transformExtent([BRAZIL_BOUNDS.west,BRAZIL_BOUNDS.south,BRAZIL_BOUNDS.east,BRAZIL_BOUNDS.north],'EPSG:4326','EPSG:3857'),constrainOnlyCenter:true}),interactions:defaults({mouseWheelZoom:false,altShiftDragRotate:false,pinchRotate:false}),controls:[new ol.control.Zoom({zoomInTipLabel:'Aproximar mapa',zoomOutTipLabel:'Afastar mapa'}),new ol.control.Attribution({collapsible:false})]});
   container.setAttribute('tabindex','0');circleSource=new ol.source.Vector();
   map.addLayer(new ol.layer.Vector({source:circleSource,zIndex:1000,style:new ol.style.Style({stroke:new ol.style.Stroke({color:'#527e20',width:2}),fill:new ol.style.Fill({color:'rgba(119,172,53,.13)'})})}));
   map.on('singleclick',event=>{const [lon,lat]=ol.proj.toLonLat(event.coordinate);if(validMapPoint(lat,lon))options?.onPick?.({lat,lon});});
   const instance=map;
   style.apply(base,'https://tiles.openfreemap.org/styles/liberty').then(()=>{if(map===instance){map.renderSync();options?.onStatus?.('Clique em um número para analisar a empresa. O círculo mostra o raio selecionado.');}}).catch(error=>{console.warn('Prospecto basemap:',error);if(map===instance)options?.onStatus?.('O fundo do mapa não carregou. Você ainda pode usar os marcadores e a lista.');});
  }
  if(options.focus)fitPoints(discoveryCircle(options.area).geometry.coordinates[0],24,15);
  refreshFeatures();map.renderSync();options.onStatus?.('Clique em um número para analisar a empresa. O círculo mostra o raio selecionado.');
 }catch(error){console.error('Prospecto map:',error);if(current===generation)options?.onStatus?.('Não foi possível iniciar o mapa neste dispositivo. A busca e a lista continuam disponíveis.');}
}
window.addEventListener('hashchange',()=>queueMicrotask(()=>{if(map&&!map.getTargetElement()?.isConnected)destroyDiscoveryMap();}));
