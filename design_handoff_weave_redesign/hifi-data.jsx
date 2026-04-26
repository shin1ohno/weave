// hifi-data.jsx — Demo data準拠 (weave-web/lib/api.ts)
const INPUT_TYPES = ["rotate","press","release","long_press","swipe_up","swipe_down","swipe_left","swipe_right","slide","hover","touch_top","touch_bottom","touch_left","touch_right","key_press"];
const INTENT_GROUPS = [
  {label:"Playback", items:["play","pause","play_pause","stop","next","previous"]},
  {label:"Continuous", items:["volume_change","volume_set","brightness_change","brightness_set","seek_relative","seek_absolute"]},
  {label:"Toggle", items:["mute","unmute","power_toggle","power_on","power_off"]},
];

const DEMO_DEVICES = [
  {edge_id:'edge-living', device_type:'nuimo', device_id:'AA:BB:CC:DD:EE:01', nickname:'sofa', battery:82, connected:true, lastInput:{input:'rotate', at:'now', value:'+3'}, connectionsCount:2, led:'vol_55'},
  {edge_id:'edge-living', device_type:'nuimo', device_id:'AA:BB:CC:DD:EE:02', nickname:'desk', battery:64, connected:true, lastInput:{input:'press', at:'2m ago'}, connectionsCount:3, led:'play'},
  {edge_id:'edge-bed', device_type:'nuimo', device_id:'AA:BB:CC:DD:EE:03', nickname:'bedside', battery:null, connected:false, connectionsCount:1, led:'blank'},
];

const DEMO_SERVICES = [
  {type:'roon', label:'Roon', status:'running', targets:[
    {id:'zone:living', label:'Living', state:{playback:'playing', volume:55, track:'Blue Monk · T. Monk'}, linkedCount:1},
    {id:'zone:kitchen', label:'Kitchen', state:{playback:'idle'}, linkedCount:0},
    {id:'zone:desk', label:'Desk', state:{playback:'idle'}, linkedCount:1},
  ]},
  {type:'hue', label:'Hue', status:'running', targets:[
    {id:'light:living', label:'Living', state:{on:true, brightness:72}, linkedCount:1},
    {id:'light:kitchen', label:'Kitchen', state:{on:false}, linkedCount:1},
    {id:'light:bedside', label:'Bedside', state:{on:false}, linkedCount:1},
  ]},
];

const DEMO_MAPPINGS = [
  {mapping_id:'m-1', edge_id:'edge-living', device_type:'nuimo', device_id:'AA:BB:CC:DD:EE:01', service_type:'roon', service_target:'zone:living', active:true,
    routes:[{input:'rotate', intent:'volume_change', params:{damping:80}},{input:'press', intent:'play_pause'},{input:'swipe_right', intent:'next'},{input:'swipe_left', intent:'previous'}],
    feedback:[{state:'playback', feedback_type:'playback_glyph'},{state:'volume', feedback_type:'volume_bar'}],
    target_candidates:[{target:'zone:living', label:'Living'},{target:'zone:kitchen', label:'Kitchen'}],
    target_switch_on:'swipe_up', firing:true, lastEvent:'rotate → volume_change · +3'},
  {mapping_id:'m-2', edge_id:'edge-living', device_type:'nuimo', device_id:'AA:BB:CC:DD:EE:01', service_type:'hue', service_target:'light:living', active:true,
    routes:[{input:'long_press', intent:'power_toggle'},{input:'slide', intent:'brightness_change'}],
    feedback:[{state:'brightness', feedback_type:'brightness_bar'}],
    target_candidates:[], target_switch_on:null, firing:false, lastEvent:'12m ago'},
  {mapping_id:'m-3', edge_id:'edge-living', device_type:'nuimo', device_id:'AA:BB:CC:DD:EE:02', service_type:'roon', service_target:'zone:desk', active:true,
    routes:[{input:'rotate', intent:'volume_change', params:{damping:80}},{input:'press', intent:'play_pause'}],
    feedback:[], target_candidates:[], target_switch_on:null, firing:false, lastEvent:'just now'},
  {mapping_id:'m-4', edge_id:'edge-living', device_type:'nuimo', device_id:'AA:BB:CC:DD:EE:02', service_type:'hue', service_target:'light:kitchen', active:false,
    routes:[{input:'press', intent:'power_toggle'}], feedback:[], target_candidates:[], target_switch_on:null, firing:false, lastEvent:'—'},
  {mapping_id:'m-5', edge_id:'edge-bed', device_type:'nuimo', device_id:'AA:BB:CC:DD:EE:03', service_type:'hue', service_target:'light:bedside', active:false,
    routes:[{input:'press', intent:'power_toggle'}], feedback:[], target_candidates:[], target_switch_on:null, firing:false, lastEvent:'—'},
];

const findDevice = (id) => DEMO_DEVICES.find(d=>d.device_id===id);
const findService = (t) => DEMO_SERVICES.find(s=>s.type===t);
const findTarget = (t, id) => findService(t)?.targets.find(x=>x.id===id);
const targetLabelFor = (t, id) => findTarget(t,id)?.label || id.split(':')[1];

const inputGlyph = (i) => ({
  rotate:'rotate', slide:'rotate',
  press:'press', release:'press', hover:'press', long_press:'long',
  swipe_up:'swipe_u', swipe_down:'swipe_d', swipe_left:'swipe_l', swipe_right:'swipe_r',
  touch_top:'touch_t', touch_bottom:'touch_b', touch_left:'touch_l', touch_right:'touch_r',
  key_press:'press',
}[i] || 'press');

Object.assign(window, {INPUT_TYPES, INTENT_GROUPS, DEMO_DEVICES, DEMO_SERVICES, DEMO_MAPPINGS, findDevice, findService, findTarget, targetLabelFor, inputGlyph});
