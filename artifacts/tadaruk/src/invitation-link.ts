export type InvitationRole='technician'|'reporter';

export function createInvitationLink(
  role:InvitationRole, organization:string, branch='', specialty=''
):string{
  const values=[role==='technician'?'t':'r',organization,branch,specialty];
  const bytes=new TextEncoder().encode(JSON.stringify(values));
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  const encoded=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const origin=typeof window!=='undefined'?window.location.origin:'';
  return `${origin}/join?i=${encoded}`;
}

export function readInvitationLink(search:string):{
  role:InvitationRole;organization:string;branch:string;specialty:string
}{
  const qs=new URLSearchParams(search);
  const encoded=qs.get('i');
  if(encoded){
    try{
      const normalized=encoded.replace(/-/g,'+').replace(/_/g,'/');
      const binary=atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'='));
      const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
      const parsed:unknown=JSON.parse(new TextDecoder().decode(bytes));
      if(Array.isArray(parsed)&&parsed.length===4&&
        parsed.every(value=>typeof value==='string')){
        const [role,organization,branch,specialty]=parsed as string[];
        if(role==='t'||role==='r'){
          return {role:role==='t'?'technician':'reporter',organization,branch,specialty};
        }
      }
    }catch{/* Support links from before compact QR invitations. */}
  }
  return {
    role:qs.get('role')==='technician'?'technician':'reporter',
    organization:qs.get('organization')||'تدارك',
    branch:qs.get('branch')||'',
    specialty:qs.get('specialty')||''
  };
}
