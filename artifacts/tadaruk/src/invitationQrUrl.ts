/**
 * Keep QR images scannable on small mobile screens. Invitation URLs can contain
 * several Arabic names and percent-encode each UTF-8 byte; a compact payload
 * is used ONLY for the QR. Shared WhatsApp/email links remain unchanged.
 * This is a demo routing format, NOT a signed or authenticated invitation.
 */
function encodeBase64Url(value:string):string{
  const bytes=new TextEncoder().encode(value);
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeBase64Url(value:string):string{
  const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);
  const binary=atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0)));
}

export function toCompactQrInviteUrl(url:string):string{
  try{
    const parsed=new URL(url);
    if(!/\/join\/?$/.test(parsed.pathname)||!parsed.searchParams.has('role'))return url;
    const params=parsed.searchParams;
    const payload=[
      params.get('role')==='technician'?'t':'r',
      params.get('organization')||'تدارك',
      params.get('branch')||'',
      params.get('specialty')||''
    ];
    return parsed.origin+parsed.pathname+'?d='+encodeBase64Url(JSON.stringify(payload));
  }catch{return url;}
}

export function readQrInviteParams(search:string):URLSearchParams{
  const params=new URLSearchParams(search);
  const encoded=params.get('d');
  if(!encoded||encoded.length>4096)return params;
  try{
    const values:unknown=JSON.parse(decodeBase64Url(encoded));
    if(!Array.isArray(values)||values.length!==4||!values.every(x=>typeof x==='string'&&x.length<=300))
      return params;
    const [role,organization,branch,specialty]=values as string[];
    const restored=new URLSearchParams();
    restored.set('role',role==='t'?'technician':'reporter');
    restored.set('organization',organization);
    if(branch)restored.set('branch',branch);
    if(specialty)restored.set('specialty',specialty);
    return restored;
  }catch{return params;}
}
