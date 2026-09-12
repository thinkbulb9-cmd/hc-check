const fs=require('fs');
const p='src/app/dashboard/page.tsx';
let s=fs.readFileSync(p,'utf8');
s=s.replace('import {useSearchParams} from "next/navigation";\n','');
s=s.replace("const nav=[['dashboard','▦','Dashboard'],['checkin','▣','Client Check-in'],['profile','○','My Profile'],['documents','□','Documents'],['resources','◇','Education & Resources'],['support','?','Support']];","const nav=[['dashboard','▦','Dashboard'],['checkin','▣','Client Check-in'],['profile','○','My Profile'],['documents','□','Documents'],['resources','◇','Education & Resources'],['support','?','Support']] as const;");
s=s.replace("name.split(' ').map(x=>x[0]).join('')","name.split(' ').map(x=>x.charAt(0)).join('')");
s=s.replace("export default function Dashboard(){const sp=useSearchParams();const [c,setC]=useState<Customer|null>(null);const [view,setView]=useState(sp.get('view')==='checkin'?'checkin':'dashboard');useEffect(()=>{fetch('/api/customer'","export default function Dashboard(){const [c,setC]=useState<Customer|null>(null);const [view,setView]=useState('dashboard');useEffect(()=>{if(typeof window!=='undefined'){const q=new URLSearchParams(window.location.search);if(q.get('view')==='checkin')setView('checkin')}},[]);useEffect(()=>{fetch('/api/customer'");
fs.writeFileSync(p,s);
console.log('Applied reference UI strict TypeScript and prerender fix');
