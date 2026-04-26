// hifi-flow.jsx — 6-step storyboard using real hifi components in miniature

function FlowStep({n, title, desc, children, accent='blue'}) {
  const colors = {blue:'bg-blue-600', orange:'bg-orange-600', green:'bg-green-600'};
  return <div className="flex h-[520px] w-[340px] flex-col overflow-hidden rounded-2xl border border-zinc-950/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
    <div className="flex items-center gap-2 border-b border-zinc-950/5 px-4 py-3 dark:border-white/10">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${colors[accent]||colors.blue}`}>{n}</span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{title}</h3>
        <p className="truncate text-[11px] text-zinc-500">{desc}</p>
      </div>
    </div>
    <div className="flex-1 overflow-hidden bg-zinc-50 p-3 dark:bg-zinc-950/50">{children}</div>
  </div>;
}

function MiniDeviceTile({device, hl}) {
  return <div className={`flex items-center gap-2 rounded-lg border p-2 ${hl?'border-blue-500 bg-blue-50 ring-2 ring-blue-500/30 dark:bg-blue-500/10':'border-zinc-950/5 bg-white dark:border-white/10 dark:bg-zinc-900'}`}>
    <NuimoViz pattern={device.led} size={28} firing={hl}/>
    <div className="min-w-0 flex-1">
      <div className="text-[12px] font-semibold">{device.nickname}</div>
      <div className="font-mono text-[9px] text-zinc-500">{device.connected?`${device.battery}% · ${device.connectionsCount}↔`:'offline'}</div>
    </div>
    {hl && <LiveDot color="orange" firing/>}
  </div>;
}
function MiniTarget({t, hl}) {
  return <div className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] ${hl?'bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-500/10':''}`}>
    <span className="flex-1 truncate">{t.label}</span>
    {t.state?.playback==='playing' && <Badge color="green">{t.state.volume}%</Badge>}
    {t.state?.on && <Badge color="amber">{t.state.brightness}%</Badge>}
    {t.linkedCount>0 && <span className="font-mono text-[9px] text-zinc-400">{t.linkedCount}↔</span>}
  </div>;
}

function StoryFlow() {
  return <div className="flex gap-4 p-4">
    <FlowStep n={1} title="Device を選ぶ" desc="Devices pane でタイルをクリック">
      <div className="flex flex-col gap-1.5">
        <div className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">Devices · 3</div>
        {DEMO_DEVICES.map((d,i) => <MiniDeviceTile key={i} device={d} hl={i===0}/>)}
        <div className="mt-2 rounded-md bg-blue-50 p-2 text-[11px] text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
          💡 <b>sofa</b> has 2 connections. Connections pane filtered to sofa.
        </div>
      </div>
    </FlowStep>

    <FlowStep n={2} title="Service target を選ぶ" desc="Services pane でターゲットをクリック or ドラッグ">
      <div className="flex flex-col gap-2">
        <div className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">Services</div>
        <div className="rounded-lg border border-zinc-950/5 bg-white p-2 dark:border-white/10 dark:bg-zinc-900">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold"><Glyph name="play" size={12}/>Roon</div>
          {DEMO_SERVICES[0].targets.map((t,i) => <MiniTarget key={i} t={t} hl={t.id==='zone:kitchen'}/>)}
        </div>
        <div className="rounded-lg border border-zinc-950/5 bg-white p-2 dark:border-white/10 dark:bg-zinc-900">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold"><Glyph name="bulb" size={12}/>Hue</div>
          {DEMO_SERVICES[1].targets.map((t,i) => <MiniTarget key={i} t={t}/>)}
        </div>
        <div className="mt-auto rounded-lg border-2 border-dashed border-blue-500 bg-blue-50 p-2 text-[11px] dark:bg-blue-500/10">
          <b className="text-blue-700 dark:text-blue-300">Draft</b>: sofa → Roon · Kitchen
          <div className="mt-0.5 font-mono text-[10px] text-zinc-500">default preset auto-applied</div>
        </div>
      </div>
    </FlowStep>

    <FlowStep n={3} title="Routes を調整" desc="Preset で即決 / gesture 単位で編集">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full border border-blue-500 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">✓ Music default</span>
          <span className="rounded-full border border-zinc-950/10 bg-white px-2 py-0.5 text-[10px] dark:border-white/10 dark:bg-zinc-900">Discovery</span>
          <span className="rounded-full border border-dashed border-zinc-950/15 bg-white px-2 py-0.5 text-[10px] text-zinc-500 dark:border-white/15 dark:bg-zinc-900">Custom</span>
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase text-zinc-500">Routes · 4</div>
        {[['rotate','volume_change','80'],['press','play_pause',''],['swipe_right','next',''],['swipe_left','previous','']].map(([i,int,p],k) => <div key={k} className="flex items-center gap-1.5 rounded border border-zinc-950/5 bg-white p-1.5 text-[11px] dark:border-white/10 dark:bg-zinc-900">
          <Glyph name="drag" size={10} className="text-zinc-300"/>
          <span className="flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-white/5"><Glyph name={inputGlyph(i)} size={10}/>{i}</span>
          <Glyph name="chevron_r" size={10} className="text-zinc-300"/>
          <span className="font-medium">{int}</span>
          {p && <span className="ml-auto font-mono text-[9px] text-zinc-400">·{p}</span>}
        </div>)}
        <div className="rounded border border-dashed border-zinc-300 p-1.5 text-[10px] text-zinc-500 dark:border-white/10">long_press · <span className="text-blue-600 dark:text-blue-400">+ assign</span></div>
      </div>
    </FlowStep>

    <FlowStep n={4} title="Try it (save前)" desc="Nuimoを触って検証" accent="orange">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center py-2">
          <NuimoViz pattern="vol_mid" size={90} firing/>
        </div>
        <div className="text-center font-mono text-[10px] text-zinc-500">LED: volume_bar · 55/100</div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/5">
          <div className="h-full w-3/5 rounded-full bg-green-500"/>
        </div>
        <div className="text-[10px] text-zinc-500">3/5 verified</div>
        <div className="flex flex-col gap-1">
          {[['rotate','volume_change','ok','52→55'],['press','play_pause','ok',''],['swipe_right','next','ok',''],['swipe_left','previous','warn','waiting'],['long_press','','pending','']].map(([i,int,s,v],k) => <div key={k} className="flex items-center gap-1.5 rounded border border-zinc-950/5 bg-white px-2 py-1 text-[10px] dark:border-white/10 dark:bg-zinc-900">
            <Glyph name={s==='ok'?'check':'dot'} size={10} className={s==='ok'?'text-green-600':s==='warn'?'text-orange-500':'text-zinc-400'}/>
            <span className="font-mono text-[9px]">{i}</span>
            <Glyph name="chevron_r" size={8} className="text-zinc-300"/>
            <span className={int?'':'italic text-zinc-400'}>{int||'unassigned'}</span>
            {v && <span className="ml-auto font-mono text-[9px] text-zinc-400">{v}</span>}
          </div>)}
        </div>
      </div>
    </FlowStep>

    <FlowStep n={5} title="Feedback (任意)" desc="Service 状態 → LED 表現">
      <div className="flex flex-col gap-2">
        <div className="rounded-lg bg-blue-50 p-2 text-center text-[11px] font-medium text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
          ✓ Music feedback preset (recommended)
        </div>
        {[['playback','playback_glyph','play'],['volume','volume_bar','vol']].map(([s,f,g],i) => <div key={i} className="flex items-center gap-2 rounded border border-zinc-950/5 bg-white px-2 py-1.5 text-[11px] dark:border-white/10 dark:bg-zinc-900">
          <span className="font-mono text-zinc-500">{s}</span>
          <Glyph name="chevron_r" size={10} className="text-zinc-400"/>
          <span className="font-medium">{f}</span>
          <Glyph name={g} size={12} className="ml-auto text-zinc-500"/>
        </div>)}
        <div className="mt-2 rounded border border-dashed border-zinc-200 p-2 text-[10px] text-zinc-500 dark:border-white/10">
          <b>Smart defaults</b>: dB-style zones auto-invert LED orientation (0 dB → "up inv")
        </div>
        <div className="mt-auto flex gap-2 pt-2">
          <Button plain size="sm" className="flex-1">Skip</Button>
          <Button color="blue" size="sm" className="flex-1"><Glyph name="check" size={12}/>Save</Button>
        </div>
        <div className="text-center font-mono text-[9px] text-blue-600 dark:text-blue-400">→ edge-agent に即配信 (再起動不要)</div>
      </div>
    </FlowStep>

    <FlowStep n={6} title="Live に戻る" desc="新 connection が active として並ぶ" accent="green">
      <div className="flex flex-col gap-2">
        <div className="relative rounded-lg border border-orange-500/60 bg-orange-50/50 p-2 ring-2 ring-orange-500/30 dark:bg-orange-500/10">
          <span className="absolute -top-2 right-2 rounded bg-orange-600 px-1.5 py-0.5 text-[9px] font-bold text-white">firing</span>
          <div className="text-[12px] font-semibold"><b>sofa</b> → Roon · Kitchen</div>
          <div className="mt-0.5 font-mono text-[10px] text-orange-700 dark:text-orange-400">just now · vol +3</div>
        </div>
        <div className="rounded-lg border border-zinc-950/5 bg-white p-2 text-[12px] dark:border-white/10 dark:bg-zinc-900">
          <b>sofa</b> → Roon · Living
        </div>
        <div className="rounded-lg border border-zinc-950/5 bg-white p-2 text-[12px] dark:border-white/10 dark:bg-zinc-900">
          <b>sofa</b> → Hue · Living
        </div>
        <div className="mt-3 text-[10px] font-semibold uppercase text-zinc-500">再編集 entry points</div>
        <ul className="space-y-1 text-[11px] text-zinc-700 dark:text-zinc-300">
          <li>· カードをクリック → inline expand</li>
          <li>· ⌘K → "edit sofa → Kitchen"</li>
          <li>· Nuimo 実機 → <GestureChip input="swipe_up"/> でターゲット切替</li>
        </ul>
        <div className="mt-auto rounded-md bg-green-50 p-2 text-[10px] font-medium text-green-800 dark:bg-green-500/10 dark:text-green-300">
          ★ 家族にとって一番自然な entry point は「Nuimo を触ること」
        </div>
      </div>
    </FlowStep>
  </div>;
}

Object.assign(window, {StoryFlow, FlowStep});
