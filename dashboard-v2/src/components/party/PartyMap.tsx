import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Crosshair, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import type { Catalog, PartyMember, DeploymentsResponse } from '../../types';
import { tacticalNavigation } from '../../models/tactical-map';
import { DecisionExplanation } from './DecisionExplanation';
import { createTerrainGroup, groupPartyPositions, projectPartyPosition } from '../../models/party-map';
import { Badge, Card, EmptyState, SelectInput, Sprite } from '../ui';
import styles from './PartyMap.module.scss';
export interface PartyMapProps { members: PartyMember[] | null; catalog?: Catalog; loading?: boolean; deployments?: DeploymentsResponse }
const COLORS = ['#6ee7b7', '#93c5fd', '#fcd34d', '#e9a8f5', '#fb923c'];
type Camera = { map: string; zoom: number; x: number; y: number };
/** Camera state is independent of telemetry refresh; following is explicit. */
export function PartyMap({ members, catalog, loading = false, deployments }: PartyMapProps) {
  const roster = members ?? [], groups = groupPartyPositions(roster, catalog?.maps);
  const [selectedMap, setSelectedMap] = useState(''), [selectedName, setSelectedName] = useState('');
  const [following, setFollowing] = useState(false), [showHistory, setShowHistory] = useState(true), [expanded, setExpanded] = useState(false);
  const [camera, setCamera] = useState<Camera>({ map: '', zoom: 1, x: 0, y: 0 });
  const stage = useRef<HTMLDivElement>(null), drag = useRef<{ id: number; x: number; y: number; cx: number; cy: number } | null>(null);
  const [size, setSize] = useState({ width: 900, height: 480 });
  const tracked = roster.find(member => member.name === selectedName);
  const navigation = tacticalNavigation(tracked);
  const trackedGroup = groups.find(group => group.members.some(member => member.name === selectedName));
  const activeMap = following && trackedGroup ? trackedGroup.map : selectedMap || groups[0]?.map || (catalog?.maps?.main ? 'main' : Object.keys(catalog?.maps ?? {})[0]) || '';
  const group = groups.find(group => group.map === activeMap) ?? (catalog?.maps?.[activeMap] ? createTerrainGroup(activeMap, catalog.maps[activeMap]) : undefined);
  const mapIds = [...new Set([...groups.map(group => group.map), ...Object.keys(catalog?.maps ?? {})])].sort();
  const width = group ? group.bounds.maxX - group.bounds.minX : 900, height = group ? group.bounds.maxY - group.bounds.minY : 600;
  const zoom = camera.map === activeMap || following ? camera.zoom : 1, scale = Math.min(size.width / width, size.height / height) * zoom;
  const world = (point: { x: number; y: number }) => { const p = projectPartyPosition(point.x, point.y, group!.bounds); return { x: p.left * width / 100, y: p.top * height / 100 }; };
  const focused = following && trackedGroup && tracked?.x != null && tracked.y != null ? world({ x: tracked.x, y: tracked.y }) : null;
  const center = focused ?? (camera.map === activeMap ? camera : { x: width / 2, y: height / 2 });
  const vw = size.width / scale, vh = size.height / scale, markerSize = 42 / scale;
  const color = (name: string) => COLORS[Math.max(0, roster.findIndex(member => member.name === name)) % COLORS.length];
  const skin = (member: PartyMember) => member.skin && catalog?.assets[`skin:${member.skin}`] ? `skin:${member.skin}` : member.class;
  const hasGroup = !!group;
  useEffect(() => {
    const node = stage.current; if (!node) return;
    const observer = new ResizeObserver(entries => { const rect = entries[0]?.contentRect; if (rect?.width && rect.height) setSize({ width: rect.width, height: rect.height }); });
    observer.observe(node); return () => observer.disconnect();
  }, [loading, hasGroup, expanded]);
  useEffect(() => { if (!expanded) return; const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [expanded]);
  function changeMap(map: string) { setSelectedMap(map); setFollowing(false); setCamera({ map: '', zoom: 1, x: 0, y: 0 }); }
  function select(member: PartyMember) {
    const destination = groups.find(group => group.members.some(p => p.name === member.name)); setSelectedName(member.name);
    if (!destination) { setFollowing(false); return; }
    const point = projectPartyPosition(member.x!, member.y!, destination.bounds);
    setSelectedMap(destination.map); setFollowing(true);
    setCamera({ map: destination.map, zoom: 2.5, x: point.left * (destination.bounds.maxX - destination.bounds.minX) / 100, y: point.top * (destination.bounds.maxY - destination.bounds.minY) / 100 });
  }
  function zoomBy(delta: number) { setCamera({ map: activeMap, zoom: Math.max(1, Math.min(8, zoom + delta)), x: center.x, y: center.y }); }
  function fit() { setFollowing(false); setCamera({ map: activeMap, zoom: 1, x: width / 2, y: height / 2 }); }
  return <Card className={`${styles.card} ${expanded ? styles.expanded : ''}`} title="Party map" headerActions={<div className={styles.headerActions}><Badge variant={groups.length ? 'success' : 'neutral'}>{groups.reduce((sum, group) => sum + group.members.length, 0)} live · {groups.length} terrains</Badge><button className={styles.iconButton} type="button" aria-label={expanded ? 'Close expanded map' : 'Expand map'} onClick={() => setExpanded(value => !value)}>{expanded ? <X size={18} /> : <Maximize2 size={18} />}</button></div>}>
    <div className={styles.toolbar}>
      <label>Terrain<SelectInput aria-label="Map terrain" value={activeMap} onChange={changeMap} options={mapIds.map(map => ({ value: map, label: `${map}${groups.find(g => g.map === map)?.members.length ? ` · ${groups.find(g => g.map === map)!.members.length} live` : ''}` }))} /></label>
      <div className={styles.occupied} aria-label="Occupied terrains">{groups.map(g => <button type="button" key={g.map} aria-pressed={g.map === activeMap} onClick={() => changeMap(g.map)}>{g.map}<span>{g.members.length}</span></button>)}</div>
      <label className={styles.historyToggle}><input type="checkbox" checked={showHistory} onChange={event => setShowHistory(event.target.checked)} /> Trails · 10 min</label>
    </div>
    {loading ? <EmptyState title="Loading positions…" /> : <div className={styles.workspace}><div className={styles.canvasColumn}>
      <div ref={stage} className={styles.stage}>
        {group ? <svg className={styles.mapCanvas} viewBox={`${center.x - vw / 2} ${center.y - vh / 2} ${vw} ${vh}`} aria-label={`${activeMap} live map`} onPointerDown={event => { if (event.button !== 0 || (event.target as Element).closest('foreignObject')) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, cx: center.x, cy: center.y }; setCamera({ map: activeMap, zoom, x: center.x, y: center.y }); setFollowing(false); }} onPointerMove={event => { const start = drag.current; if (!start || start.id !== event.pointerId) return; setCamera({ map: activeMap, zoom, x: start.cx - (event.clientX - start.x) / scale, y: start.cy - (event.clientY - start.y) / scale }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          <rect width={width} height={height} fill="#121b23" />{group.asset && <image href={group.asset.src} width={width} height={height} preserveAspectRatio="none" />}
          {navigation?.destination?.map === activeMap ? (() => {
            const destination = world(navigation.destination!);
            const origin = tracked?.map === activeMap && tracked.x != null && tracked.y != null ? world({ x: tracked.x, y: tracked.y }) : null;
            const stroke = navigation.blocked ? '#fbbf24' : color(selectedName);
            return <g aria-label={`${selectedName} destination`}>
              {origin ? <line x1={origin.x} y1={origin.y} x2={destination.x} y2={destination.y} stroke={stroke} strokeWidth="2" strokeDasharray="6 6" vectorEffect="non-scaling-stroke"><title>Direction to destination, not a calculated path</title></line> : null}
              <circle cx={destination.x} cy={destination.y} r={10 / scale} stroke={stroke} strokeWidth="2" fill="#101820" vectorEffect="non-scaling-stroke" />
              <path d={`M${destination.x - 5 / scale},${destination.y}h${10 / scale} M${destination.x},${destination.y - 5 / scale}v${10 / scale}`} stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </g>;
          })() : null}
          {showHistory && roster.flatMap(member => (member.positionHistory ?? []).flatMap((point, index, points) => { const prev = points[index - 1]; if (!prev || point.map !== activeMap || prev.map !== activeMap || prev.server !== point.server || point.at - prev.at >= 20000 || Date.now() - point.at > 600000) return []; const from = world(prev), to = world(point); return <line aria-hidden="true" key={`${member.name}:${point.at}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color(member.name)} strokeWidth={member.name === selectedName ? 3 : 1.5} vectorEffect="non-scaling-stroke" opacity={Math.max(.12, 1 - (Date.now() - point.at) / 600000)}><title>{member.name} · {new Date(point.at).toLocaleTimeString()}</title></line>; }))}
          {group.members.map((member, index) => { const point = world(member), overlaps = group.members.slice(0, index).filter(other => Math.hypot(world(other).x - point.x, world(other).y - point.y) * scale < 44).length, offset = overlaps * 30 / scale; return <g key={member.name}><circle cx={point.x} cy={point.y} r={4 / scale} fill={color(member.name)} /><line x1={point.x} y1={point.y} x2={point.x + offset} y2={point.y - markerSize / 2} stroke={color(member.name)} strokeWidth="1" vectorEffect="non-scaling-stroke" /><foreignObject x={point.x - markerSize / 2 + offset} y={point.y - markerSize * 1.6} width={markerSize * 2.4} height={markerSize * 1.7} overflow="visible"><div style={{ transform: `scale(${1 / scale})`, transformOrigin: 'top left', '--member-color': color(member.name) } as CSSProperties}><button type="button" className={styles.marker} aria-label={`Locate ${member.name}`} aria-pressed={selectedName === member.name} onClick={() => select(member)} title={`${member.name} · ${Math.round(member.x)}, ${Math.round(member.y)}`}><Sprite id={skin(member)} catalog={catalog} label={member.name} size={30} /><span>{member.name}</span></button></div></foreignObject></g>; })}
        </svg> : <div className={styles.noMap}><EmptyState title="No live positions" description="Choose a terrain to explore. Offline characters remain listed beside the map." /></div>}
        <div className={styles.mapCaption}><b>{activeMap || 'No terrain'}</b><span>{group?.asset ? 'Game terrain' : 'Coordinates only · terrain unavailable'}</span></div>
        <div className={styles.cameraTools} aria-label="Map camera controls"><button type="button" aria-label="Zoom in" disabled={!group || zoom >= 8} onClick={() => zoomBy(.5)}><Plus size={18} /></button><span>{zoom.toFixed(1)}×</span><button type="button" aria-label="Zoom out" disabled={!group || zoom <= 1} onClick={() => zoomBy(-.5)}><Minus size={18} /></button><button type="button" aria-label="Fit terrain" disabled={!group} onClick={fit}><RotateCcw size={18} /></button></div>
        {following && trackedGroup && <div className={styles.followBadge}><Crosshair size={14} /> Following {selectedName}</div>}
      </div><div className={styles.mapHelp}><span>Drag to pan · select a character to follow</span><span>Dots: positions · crosshair: destination · dashed line: direction, not path</span></div>
    </div><aside className={styles.sidebar} aria-label="Map party roster"><div className={styles.sidebarHeading}>Your team<span>{roster.length} characters</span></div><div className={styles.roster}>{roster.map(member => { const live = groups.some(g => g.members.some(p => p.name === member.name)); return <button type="button" key={member.name} className={styles.member} aria-pressed={selectedName === member.name} onClick={() => select(member)} style={{ '--member-color': color(member.name) } as CSSProperties}><Sprite id={skin(member)} catalog={catalog} label={member.name} size={32} /><span><strong>{member.name}</strong><small>{live ? member.map : member.status === 'disabled' ? 'Disabled' : 'Offline · no live position'}</small></span><i className={live ? styles.liveDot : styles.offlineDot} /></button>; })}</div>
      {tracked ? <div className={styles.details}><div><strong>{tracked.name}</strong><Badge variant={trackedGroup ? 'success' : 'neutral'}>{tracked.status}</Badge></div><p>{trackedGroup ? tracked.intent?.state || tracked.class : 'Live telemetry unavailable'}</p>{trackedGroup && <><dl><div><dt>Position</dt><dd>{tracked.map} · {Math.round(tracked.x!)} / {Math.round(tracked.y!)}</dd></div><div><dt>HP</dt><dd>{tracked.hp?.toLocaleString() ?? '—'} / {tracked.maxHp?.toLocaleString() ?? '—'}</dd></div><div><dt>Target</dt><dd>{tracked.target || 'None'}</dd></div></dl><div className={styles.navigation}><strong>Navigation</strong><p>{navigation?.destination ? `${navigation.destination.map} · ${Math.round(navigation.destination.x)}, ${Math.round(navigation.destination.y)}` : 'No destination reported'}</p>{navigation?.blocked ? <p className={styles.blocked}>{navigation.reason || 'Movement recovery'} · attempt {navigation.attempts} · {Math.floor(navigation.stalledForMs / 1000)}s without progress</p> : null}{navigation?.destination && navigation.destination.map !== activeMap ? <button type="button" className={styles.followButton} onClick={() => changeMap(navigation.destination!.map)}>View destination terrain</button> : null}</div><DecisionExplanation character={tracked.name} enabled={tracked.status !== 'disabled'} telemetry={deployments?.characters[tracked.name]?.telemetry ?? undefined} /><button className={styles.followButton} type="button" aria-pressed={following} onClick={() => { if (following) { setCamera({ map: activeMap, zoom, x: center.x, y: center.y }); setFollowing(false); } else select(tracked); }}><Crosshair size={15} />{following ? 'Stop following' : 'Follow character'}</button></>}</div> : <p className={styles.selectHint}>Select a character to inspect its position and activity.</p>}
    </aside></div>}
  </Card>;
}
