import { divIcon } from "leaflet";

const drawings = {
  sensor:'<path d="M12 19v-5m-3 7h6M7.8 16a6 6 0 0 1 0-8m8.4 0a6 6 0 0 1 0 8M4.9 19a10 10 0 0 1 0-14m14.2 0a10 10 0 0 1 0 14"/><circle cx="12" cy="11" r="2"/>',
  fire:'<path d="M12 3c1 5-4 6-4 10a4 4 0 0 0 8 0c0-2-1-3-1-3s4 2 4 6a7 7 0 0 1-14 0c0-6 7-7 7-13Z"/>',
  earthquake:'<path d="M2 12h4l3-8 5 16 3-8h5"/>',
};
const colors:Record<string,string>={calm:'#218160',warning:'#a96a05',danger:'#b93943',pending:'#697c90',fire:'#bd4b12',earthquake:'#6847bb'};
const icons=new Map<string,ReturnType<typeof divIcon>>();
export function mapIcon(kind:keyof typeof drawings,tone:string=kind) {
  const key=`${kind}-${tone}`;
  if(!icons.has(key))icons.set(key,divIcon({className:'aerosense-map-marker',html:`<span class="map-pin pin-${kind}" style="--pin-color:${colors[tone]||colors.pending}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[kind]}</svg></span>`,iconSize:[34,40],iconAnchor:[17,38],popupAnchor:[0,-34]}));
  return icons.get(key)!;
}
