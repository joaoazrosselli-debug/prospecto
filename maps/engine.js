import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Overlay from 'ol/Overlay.js';
import Group from 'ol/layer/Group.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import Zoom from 'ol/control/Zoom.js';
import Attribution from 'ol/control/Attribution.js';
import {defaults} from 'ol/interaction/defaults.js';
import {fromLonLat,toLonLat,transformExtent} from 'ol/proj.js';
import {apply} from 'ol-mapbox-style';

// Both packages share one module graph. The production bundle uses Canvas 2D;
// no global compatibility shims, external script CDN, or WebGL are required.
export const ol={Map,View,Overlay,layer:{Group,Vector:VectorLayer},source:{Vector:VectorSource},format:{GeoJSON},style:{Style,Stroke,Fill},control:{Zoom,Attribution},interaction:{defaults},proj:{fromLonLat,toLonLat,transformExtent}};
export const style={apply};
