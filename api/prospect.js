module.exports=async function(req,res){
res.setHeader('Cache-Control','no-store');
if(req.method!=='POST')return res.status(405).json({error:'Use POST'});
const key=process.env.GOOGLE_PLACES_API_KEY;
if(!key)return res.status(503).json({error:'Configure GOOGLE_PLACES_API_KEY na Vercel'});
try{
const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
const niche=String(b.niche||'').trim(),city=String(b.city||'').trim(),radius=Number(b.radius),limit=Number(b.limit);
if(!niche||!city||niche.length>100||city.length>100||!Number.isInteger(radius)||radius<1||radius>50||!Number.isInteger(limit)||limit<1||limit>100)return res.status(400).json({error:'Filtros inválidos'});
const get=async(url,options)=>{const r=await fetch(url,{...options,signal:AbortSignal.timeout(12000)});if(!r.ok){let e=new Error('Google retornou HTTP '+r.status);throw e}return r.json()};
const geo=await get('https://maps.googleapis.com/maps/api/geocode/json?address='+encodeURIComponent(city+', Brasil')+'&region=br&key='+encodeURIComponent(key));
if(geo.status!=='OK'||!geo.results?.length)return res.status(422).json({error:'Geocoding: '+geo.status});
const {lat,lng}=geo.results[0].geometry.location, dy=radius/111.195,dx=dy/Math.max(.05,Math.cos(lat*Math.PI/180));
const dist=(a,o)=>{const rad=x=>x*Math.PI/180;const h=Math.sin(rad(a-lat)/2)**2+Math.cos(rad(lat))*Math.cos(rad(a))*Math.sin(rad(o-lng)/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,h)))};
const body={textQuery:niche+' em '+city,languageCode:'pt-BR',regionCode:'BR',pageSize:Math.min(20,limit),locationRestriction:{rectangle:{low:{latitude:Math.max(-90,lat-dy),longitude:Math.max(-180,lng-dx)},high:{latitude:Math.min(90,lat+dy),longitude:Math.min(180,lng+dx)}}}};
const places=new Map();let next;
for(let i=0;i<3;i++){
const data=await get('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,nextPageToken'},body:JSON.stringify({...body,...(next?{pageToken:next}:{})})});
for(const p of data.places||[]){if(!p.id||!p.location||p.businessStatus!=='OPERATIONAL')continue;const distance=dist(p.location.latitude,p.location.longitude);if(distance>radius||(b.requirePhone&&!p.internationalPhoneNumber))continue;places.set(p.id,{id:p.id,name:p.displayName?.text||'',address:p.formattedAddress||'',phone:p.internationalPhoneNumber||'',website:p.websiteUri||'',maps:p.googleMapsUri||'',distance:Math.round(distance*10)/10})}
next=data.nextPageToken;if(!next||places.size>=limit)break;
}
let results=[...places.values()];if(b.prioritizeNoSite)results.sort((a,b)=>Number(!!a.website)-Number(!!b.website));return res.json({results:results.slice(0,limit),note:'Consulta limitada a três páginas. Ausência de site cadastrado não comprova inexistência de site. Fonte: Google Maps.'});
}catch(e){return res.status(502).json({error: /^Google retornou HTTP/.test(e.message)?e.message:'Falha na consulta ao Google. Verifique APIs, faturamento e restrições.'})}
};