const fs = require('fs');

let text = fs.readFileSync('src/components/dashboard/AttendeeDashboard.tsx', 'utf-8');

let m1_regex = /\{\/\*\s*SECTION:\s*LIVE MAP.*?\*\/\s*<div className="space-y-4">\s*<div className="flex items-center justify-between px-2">([\s\S]*?)<Card className="bg-slate-900 border-white\/5([^>]*)>/;

const m1 = text.match(m1_regex);
if (m1) {
    let new_top = `{/* SECTION: LIVE MAP (SMALLER CARD LAYOUT) */}
            <div className="space-y-6">
               <div className="flex items-center justify-between px-2">${m1[1]}<div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
                  <div className="flex flex-col">
                   <Card className="bg-slate-900 border-white/5${m1[2]} h-full flex flex-col min-h-[400px]">`;
    text = text.replace(m1_regex, new_top);
    console.log("M1 replaced");
} else {
    console.log("M1 failed");
}

const t = 't'; // placeholder for template literal

let m2_regex = /(\s*Reset View\s*<\/Button>\s*)\}\)\s*<\/div>\s*<\/div>\s*<\/Card>\s*<\/div>/;

const m2 = text.match(m2_regex);
if (m2) {
    let new_end = m2[1] + `)}
                     </div>
                  </div>
               </Card>
                  </div>
                  
                  {/* Right Column: Intelligence */}
                  <div className="flex flex-col">
                     <AnimatePresence mode="wait">
                        {(clickedZoneId || selectedGateId) ? (
                           <motion.div
                              key="intel-selected"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="h-full"
                           >
                              <Card className="bg-slate-900/90 border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-xl h-full flex flex-col shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)]">
                                 <div className="p-8 flex flex-col flex-1 gap-8 overflow-y-auto no-scrollbar">
                                    <div className="flex justify-between items-start">
                                       <div className="space-y-2">
                                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                             <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                                             <span className="text-[8px] text-white/50 font-black uppercase tracking-widest">{selectedGateId ? t('access_point_delta') : t('area_flow_analysis')}</span>
                                          </div>
                                          <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                                             {selectedGateId ? clickedGate?.label : clickedZone?.name.replace(/cat\\s\\d\\s+/gi, '').trim()}
                                          </h3>
                                       </div>
                                       <Button 
                                         variant="ghost" 
                                         size="icon" 
                                         onClick={() => { setClickedZoneId(null); setSelectedGateId(null); }} 
                                         className="text-white/20 hover:text-white h-10 w-10 bg-white/5 rounded-2xl shrink-0"
                                       >
                                          <XCircle className="h-6 w-6" />
                                       </Button>
                                    </div>

                                    {selectedGateId ? (
                                      <div className="flex flex-col gap-6 flex-1">
                                         <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex-1 flex flex-col justify-center">
                                            <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-2 text-left">{t('realtime_load')}</p>
                                            <p className="text-5xl font-black text-white text-left">{clickedGate?.currentLoad}</p>
                                            <p className="text-[8px] text-white/20 font-bold uppercase mt-4 text-left">{t('traffic_delta_min')}</p>
                                         </div>
                                         <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex-1 flex flex-col justify-center">
                                            <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-2 text-left">{t('gate_policy')}</p>
                                            <p className={\`text-4xl font-black uppercase tracking-tighter text-left \${clickedGate?.status === 'CROWDED' ? 'text-red-500' : 'text-green-500'}\`}>{clickedGate?.status}</p>
                                            <p className="text-[8px] text-white/20 font-bold uppercase mt-4 text-left">{t('system_verified')}</p>
                                         </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-6 flex-1">
                                         <div className="bg-white/5 p-6 sm:p-8 rounded-[2.5rem] border border-white/5 group transition-colors hover:bg-white/10 flex flex-col justify-center">
                                            <div className="flex justify-between items-end">
                                               <div className="text-left">
                                                  <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mb-2">{t('utilized_density')}</p>
                                                  <p className={\`text-5xl sm:text-6xl font-black tracking-tighter \${
                                                    (clickedZone?.peopleCount / (clickedZone?.capacity || 2000)) > 0.85 ? 'text-red-500' : 'text-blue-500'
                                                  }\`}>
                                                    {Math.round((clickedZone?.peopleCount / (clickedZone?.capacity || 2000)) * 100)}%
                                                  </p>
                                               </div>
                                               <div className="text-right">
                                                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 ml-auto">
                                                     <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white/40" />
                                                  </div>
                                                  <p className="text-[9px] sm:text-[10px] text-white/30 font-black uppercase tracking-widest mb-1">{t('sensor_count')}</p>
                                                  <p className="text-lg sm:text-xl font-bold text-white/60 tabular-nums">{Math.floor(clickedZone?.peopleCount)}</p>
                                               </div>
                                            </div>
                                         </div>
                                         
                                         <div className="bg-slate-950 p-6 sm:p-8 rounded-3xl border border-white/5 flex flex-col gap-5 relative overflow-hidden flex-1 justify-center">
                                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                               <Shield className="h-24 w-24 text-white" />
                                            </div>
                                            <div className={\`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg \${
                                              (clickedZone?.peopleCount / (clickedZone?.capacity || 2000)) > 0.85 ? 'bg-red-600/20 text-red-500' : 'bg-green-600/20 text-green-500'
                                            }\`}>
                                               <Shield className="h-6 w-6" />
                                            </div>
                                            <div className="space-y-2 text-left relative z-10">
                                               <p className="text-sm font-black text-white uppercase tracking-tight">{t('exit_strategies')}</p>
                                               <p className="text-[11px] text-white/40 leading-relaxed font-medium pb-2">
                                                  {(clickedZone?.peopleCount / (clickedZone?.capacity || 2000)) > 0.85 
                                                     ? "DENSITY RISK Detected: High sensor saturation. System recommends immediate relocation to adjacent green sectors." 
                                                     : "SYSTEM CLEAR: Flow metrics within optimal safety parameters. Static density confirmed below critical thresholds."}
                                               </p>
                                               <Button 
                                                 onClick={() => {
                                                   if (clickedZone) {
                                                      setSelectedZoneId(clickedZone.id);
                                                      setCurrentZone(clickedZone);
                                                      toast.success(\`\${t('joined')} \${clickedZone.name}\`);
                                                   }
                                                 }}
                                                 disabled={selectedZoneId === clickedZone?.id}
                                                 className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest h-12 shadow-lg shadow-blue-600/20 mt-auto"
                                               >
                                                 {selectedZoneId === clickedZone?.id ? 'CONTINUE AS VISITOR' : t('join_now')}
                                               </Button>
                                            </div>
                                         </div>
                                      </div>
                                    )}
                                 </div>
                              </Card>
                           </motion.div>
                        ) : (
                           <motion.div
                              key="intel-empty"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="h-full bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]"
                           >
                              <Shield className="h-12 w-12 text-white/5" />
                              <p className="text-white/20 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                                 Select a zone or gate<br/>to analyze telemetry
                              </p>
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>
               </div>
            </div>`;
            
    text = text.replace(m2_regex, new_end);
    console.log("M2 replaced");
} else {
    console.log("M2 failed");
}

fs.writeFileSync('src/components/dashboard/AttendeeDashboard.tsx', text, 'utf-8');
console.log("Done");
