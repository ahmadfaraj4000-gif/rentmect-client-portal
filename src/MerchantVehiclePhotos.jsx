import React,{useEffect,useState,useCallback} from 'react';
import MerchantDialog from './MerchantDialog.jsx';
export default function MerchantVehiclePhotos({vehicleId,load,onClose}){
 const [vehicle,setVehicle]=useState(null),[error,setError]=useState(''),[index,setIndex]=useState(0);
 const close=useCallback(onClose,[onClose]);
 useEffect(()=>{let active=true;load(vehicleId).then(x=>{if(active)setVehicle(x.vehicle);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[vehicleId,load]);
 const photos=[...new Set([...(vehicle?.image_urls||[]),vehicle?.image_url].filter(u=>{try{return new URL(u).protocol==='https:';}catch{return false;}}))];
 return <MerchantDialog title={vehicle?.name||'Vehicle photos'} onClose={close}>{error?<p role="alert">{error}</p>:!vehicle?<p role="status">Loading vehicle photos…</p>:photos.length?<><img className="merchant-vehicle-photo" src={photos[index]} alt={`${vehicle.name} — photo ${index+1}`} /><div className="merchant-actions"><button type="button" disabled={index===0} onClick={()=>setIndex(index-1)}>Previous</button><span>{index+1} / {photos.length}</span><button type="button" disabled={index===photos.length-1} onClick={()=>setIndex(index+1)}>Next</button></div></>:<p>No photos have been added for this vehicle.</p>}{vehicle?.description&&<p>{vehicle.description}</p>}</MerchantDialog>;
}
