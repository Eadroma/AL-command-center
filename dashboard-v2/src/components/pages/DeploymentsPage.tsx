import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Scale } from 'lucide-react';
import { api } from '../../api/client';
import { Badge, Button, EmptyState, SectionHead } from '../ui';
import styles from './DeploymentsPage.module.scss';

interface Backup { id:string;character:string;slot:string;name:string;at:string;bytes:number;hash:string; }
interface Comparison { same:boolean;backupHash:string;currentHash:string;backupLines:number;currentLines:number;lineDelta:number; }

export function DeploymentsPage(){
 const client=useQueryClient();
 const history=useQuery({queryKey:['deployment-history'],queryFn:({signal})=>api<{backups:Backup[]}>('/api/deployment-history',undefined,'GET',signal)});
 const compare=useMutation({mutationFn:(id:string)=>api<Comparison>(`/api/deployment-history/${id}/compare`,undefined,'GET')});
 const rollback=useMutation({mutationFn:(id:string)=>api(`/api/deployment-history/${id}/rollback`,{}),onSuccess:()=>client.invalidateQueries({queryKey:['deployments']})});
 const error=history.error?.message||compare.error?.message||rollback.error?.message;
 return <section aria-label="Deployment history"><SectionHead eyebrow="Verified CODE backups" title="Deployments & rollback"><Badge variant="info">{history.data?.backups.length??0} backups</Badge></SectionHead>
  <p className={styles.description}>Every deployment preserves the previous slot. Compare a backup with the current game slot before restoring it; rollback also backs up the current version first.</p>
  {history.isLoading&&<EmptyState title="Loading deployment history…"/>}{error&&<p role="alert" className={styles.error}>{error}</p>}
  {!history.isLoading&&!history.data?.backups.length&&<EmptyState title="No CODE backups yet"/>}
  <div className={styles.list}>{history.data?.backups.map(item=><article key={item.id}><div><strong>{item.character}</strong><span>{new Date(item.at).toLocaleString()} · slot {item.slot} · {(item.bytes/1024).toFixed(1)} KiB</span><code>{item.hash.slice(0,16)}</code></div><div className={styles.actions}><Button size="small" variant="ghost" onClick={()=>compare.mutate(item.id)} disabled={compare.isPending}><Scale size={13}/> Compare</Button><Button size="small" variant="danger" onClick={()=>rollback.mutate(item.id)} disabled={rollback.isPending}><RotateCcw size={13}/> Roll back</Button></div>{compare.variables===item.id&&compare.data?<p className={compare.data.same?styles.same:styles.changed}>{compare.data.same?'Identical to current slot':`Different · ${compare.data.backupLines} → ${compare.data.currentLines} lines (${compare.data.lineDelta>=0?'+':''}${compare.data.lineDelta})`} · current {compare.data.currentHash.slice(0,12)}</p>:null}</article>)}</div>
 </section>;
}
