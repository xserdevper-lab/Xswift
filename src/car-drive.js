const DB='xswift-photos';
function open(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
async function query(mode,run){const db=await open();try{return await new Promise((ok,no)=>{const tx=db.transaction('images',mode);const r=run(tx.objectStore('images'));r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);tx.onerror=()=>no(tx.error);});}finally{db.close();}}
export async function uploadCarImage(file){if(!file||!file.type.startsWith('image/'))throw Error('Choose an image');const fileId='local-'+crypto.randomUUID();await query('readwrite',s=>s.put(file,fileId));return {fileId};}
export async function loadCarImage(fileId){if(!fileId)return '';const blob=await query('readonly',s=>s.get(fileId));return blob?URL.createObjectURL(blob):'';}
