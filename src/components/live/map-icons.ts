import { divIcon } from "leaflet";
import { mapDrawings } from "./map-drawings";

const colors:Record<string,string>={calm:'#218160',warning:'#a96a05',danger:'#b93943',pending:'#697c90',fire:'#bd4b12',earthquake:'#6847bb'};
const icons=new Map<string,ReturnType<typeof divIcon>>();
export function mapIcon(kind:keyof typeof mapDrawings,tone:string=kind,active=false) {
  const key=`${kind}-${tone}-${active}`;
  if(!icons.has(key))icons.set(key,divIcon({className:'aerosense-map-marker',html:`<span class="map-pin pin-${kind}${active?' is-active':''}" style="--pin-color:${colors[tone]||colors.pending}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${mapDrawings[kind]}</svg></span>`,iconSize:[32,32],iconAnchor:[16,16],popupAnchor:[0,-18]}));
  return icons.get(key)!;
}
