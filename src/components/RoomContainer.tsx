import React, { useEffect, useState } from "react";
import { db, auth, OperationType, handleFirestoreError } from "../firebase";
import { doc, onSnapshot, collection, updateDoc, deleteDoc, getDoc, deleteField } from "firebase/firestore";
import { CATEGORIES } from "../constants";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Check, X, Crown, Clock } from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "../lib/utils";

export default function RoomContainer({ roomId, onLeave }: { roomId: string, onLeave: () => void }) {
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Time remaining locally computed
  const [timeLeft, setTimeLeft] = useState(0);
  const transitioningRef = React.useRef(false);

  useEffect(() => {
    const unsubRoom = onSnapshot(doc(db, "rooms", roomId), (docSnap) => {
      if (docSnap.exists()) {
        setRoom(docSnap.data());
      } else {
        // Room deleted
        onLeave();
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`));

    const unsubPlayers = onSnapshot(collection(db, "rooms", roomId, "players"), (snap) => {
      const p: any[] = [];
      snap.forEach(d => p.push(d.data()));
      setPlayers(p);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, `rooms/${roomId}/players`));

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomId]);

  useEffect(() => {
    transitioningRef.current = false;
  }, [room?.status, room?.currentRound]);

  useEffect(() => {
    if (!room) return;

    const interval = setInterval(() => {
      if (room.status === "playing" && room.roundEndTime) {
        const remaining = Math.max(0, Math.floor((room.roundEndTime - Date.now()) / 1000));
        setTimeLeft(remaining);
        
        // Host advances to voting when time is up
        if (remaining === 0 && room.hostId === auth.currentUser?.uid) {
           if (!transitioningRef.current) {
             transitioningRef.current = true;
             updateDoc(doc(db, "rooms", roomId), { status: "voting" }).catch(console.error);
           }
        }
      } else if (room.status === "result" && room.roundEndTime) {
        const remaining = Math.max(0, Math.floor((room.roundEndTime - Date.now()) / 1000));
        setTimeLeft(remaining);

        // Host advances to next round or finish
        if (remaining === 0 && room.hostId === auth.currentUser?.uid) {
           if (!transitioningRef.current) {
             transitioningRef.current = true;
             if (room.currentRound >= room.totalRounds) {
                updateDoc(doc(db, "rooms", roomId), { status: "finished" }).catch(console.error);
             } else {
               startNextRound();
             }
           }
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [room]);

  const handleLeave = async () => {
    try {
      if (room?.hostId === auth.currentUser?.uid) {
        // Just delete the player, but if host leaves... maybe just let them leave.
        // Easiest is to just go to home screen for demo purposes
      }
      await deleteDoc(doc(db, "rooms", roomId, "players", auth.currentUser!.uid));
    } catch(e) {
      console.error(e);
    }
    onLeave();
  };

  const startNextRound = async () => {
    if (room?.hostId !== auth.currentUser?.uid) return;
    
    // Pick random imposter from current players
    const randomPlayer = players[Math.floor(Math.random() * players.length)];
    const imposterId = randomPlayer.userId;

    // Pick random word
    const catWords = CATEGORIES[room.category as keyof typeof CATEGORIES].words;
    const word = catWords[Math.floor(Math.random() * catWords.length)];

    // Reset votes in parallel
    const promises = players.map(p => 
       updateDoc(doc(db, "rooms", roomId, "players", p.userId), { vote: deleteField() }).catch(console.error)
    );
    await Promise.all(promises);

    await updateDoc(doc(db, "rooms", roomId), {
      status: "playing",
      currentRound: room.currentRound + 1,
      currentWord: word,
      imposterId: imposterId,
      roundEndTime: Date.now() + 60 * 1000 // 60s
    });
  };

  const isHost = room?.hostId === auth.currentUser?.uid;
  const me = players.find(p => p.userId === auth.currentUser?.uid);

  useEffect(() => {
    if (!room || !isHost || room.status !== "voting") return;

    const allVoted = players.length > 0 && players.every(p => p.vote);
    if (allVoted && !transitioningRef.current) {
        transitioningRef.current = true;
        
        let imposterVotes = 0;
        const voteCounts: Record<string, number> = {};
        players.forEach(p => {
           if (p.vote) {
             voteCounts[p.vote] = (voteCounts[p.vote] || 0) + 1;
             if (p.vote === room.imposterId) imposterVotes++;
           }
        });

        let maxVotes = 0;
        Object.values(voteCounts).forEach(v => {
           if (v > maxVotes) maxVotes = v;
        });

        const caught = voteCounts[room.imposterId] === maxVotes && maxVotes > 0;

        const promises = players.map(p => {
           let add = 0;
           if (p.userId === room.imposterId) {
             if (!caught) add = 3;
           } else {
             if (caught) add = 3;
           }
           if (add > 0) {
             return updateDoc(doc(db, "rooms", roomId, "players", p.userId), { score: p.score + add });
           }
           return Promise.resolve();
        });

        Promise.all(promises).then(() => {
           return updateDoc(doc(db, "rooms", roomId), {
             status: "result",
             roundEndTime: Date.now() + 10 * 1000
           });
        }).catch(console.error);
    }
  }, [room, players, isHost, roomId]);

  if (loading || !room) {
    return <div className="flex-1 flex items-center justify-center">Li benda Jûrê...</div>;
  }

  const renderContent = () => {
    switch (room.status) {
      case "waiting":
        return (
          <div className="flex-1 flex flex-col pt-4">
             <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-6 mb-6 text-center shadow-lg">
               <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Koda Jûrê</p>
               <h2 className="text-6xl font-black tracking-[0.3em] bg-slate-950 rounded-2xl py-4 text-indigo-400 inline-block px-10 shadow-inner border border-white/5 uppercase relative overflow-hidden group">
                 {room.code}
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
               </h2>
               <div className="mt-4 flex gap-4 justify-center text-[10px] font-bold uppercase tracking-wider">
                  <div className="bg-slate-950 px-4 py-2 rounded-lg text-slate-300 border border-white/5">
                    <span className="text-slate-500 mr-2">Pol:</span>{CATEGORIES[room.category as keyof typeof CATEGORIES]?.name || room.category}
                  </div>
                  <div className="bg-slate-950 px-4 py-2 rounded-lg text-slate-300 border border-white/5">
                    <span className="text-slate-500 mr-2">Geryan:</span>{room.totalRounds}
                  </div>
               </div>
             </div>

             <h3 className="text-sm font-black mb-4 px-2 flex items-center justify-between uppercase tracking-widest text-slate-500">
                <span>Yarîkeran <span className="text-indigo-400">({players.length})</span></span>
             </h3>
             <div className="grid grid-cols-2 gap-3 mb-auto overflow-y-auto pr-2 pb-6">
                {players.map(p => (
                   <div key={p.userId} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-black text-lg text-white shadow-lg">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="font-bold truncate text-sm">{p.name}</p>
                         {p.userId === room.hostId && (
                           <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest flex items-center gap-1 mt-0.5"><Crown size={12}/> Host</p>
                         )}
                      </div>
                   </div>
                ))}
             </div>

             {isHost && (
                <button onClick={startNextRound} disabled={players.length < 3} className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black text-lg tracking-wide hover:bg-indigo-500 transition-all disabled:opacity-50 mt-4 shadow-xl shadow-indigo-500/20 uppercase">
                  {players.length < 3 ? "Kêmanî 3 yarîker" : "Yariyê Destpêbike"}
                </button>
             )}
             {!isHost && (
                <div className="text-center p-4 bg-slate-900/50 rounded-xl text-slate-400 font-bold uppercase tracking-widest text-[10px] border border-white/5">
                  Li benda host e ku destpê bike...
                </div>
             )}
          </div>
        );
      case "playing":
        const isImposter = room.imposterId === auth.currentUser?.uid;
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
             <div className="w-24 h-24 rounded-full border-4 border-slate-800 flex items-center justify-center mb-12 relative shadow-lg">
               <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                 <circle cx="50" cy="50" r="46" fill="transparent" stroke="#1e293b" strokeWidth="8" />
                 <circle cx="50" cy="50" r="46" fill="transparent" stroke="#6366f1" strokeWidth="8" strokeDasharray={289} strokeDashoffset={289 - (289 * timeLeft) / 60} className="transition-all duration-1000 ease-linear" />
               </svg>
               <span className="text-3xl font-black text-indigo-400 font-mono tracking-tighter">{Math.max(0, timeLeft)}</span>
             </div>

             <div className="space-y-2 mb-12">
               <p className="text-slate-500 font-black tracking-widest uppercase text-xs">Geryana {room.currentRound} ji {room.totalRounds}</p>
             </div>

             <div className="bg-indigo-600/20 border-2 border-indigo-500/50 w-full p-10 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[250px]">
                {isImposter ? (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="relative z-10 w-full">
                     <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                        <span className="font-black text-5xl tracking-tighter uppercase whitespace-nowrap">Sextekar</span>
                     </div>
                     <h2 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Rola Te</h2>
                     <p className="text-rose-500 font-black text-4xl mb-4 tracking-tighter shadow-sm">TU SEXTEKARÎ!</p>
                     <p className="text-indigo-300 text-[10px] font-bold tracking-widest uppercase">Xwe eşkere neke!</p>
                  </motion.div>
                ) : (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="relative z-10 w-full">
                     <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none -mt-4">
                        <span className="font-black text-7xl tracking-tighter uppercase whitespace-nowrap">Peyv</span>
                     </div>
                     <h2 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Peyva Veşartî</h2>
                     <p className="text-5xl font-black tracking-tighter text-white mb-4 drop-shadow-md">{room.currentWord}</p>
                     <p className="text-indigo-300 text-[10px] font-bold tracking-widest uppercase italic">Hemî kes peyvekê dizanin...</p>
                  </motion.div>
                )}
             </div>
          </div>
        );
      case "voting":
        return (
          <div className="flex-1 flex flex-col justify-center pt-8">
             <div className="text-center mb-10">
                <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Dengdan</h2>
                <p className="text-slate-400 font-bold text-xs tracking-widest uppercase">Kî sextekar e?</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
                {players.map(p => {
                   const hasVotedMe = players.filter(voter => voter.vote === p.userId);
                   const isMe = p.userId === auth.currentUser?.uid;
                   
                   return (
                     <button
                        key={p.userId}
                        disabled={isMe || !!me?.vote}
                        onClick={() => updateDoc(doc(db, "rooms", roomId, "players", auth.currentUser!.uid), { vote: p.userId })}
                        className={cn(
                           "bg-slate-900/80 border border-white/10 rounded-2xl p-4 flex flex-col items-center relative transition-all",
                           me?.vote === p.userId && "ring-2 ring-indigo-500 ring-offset-4 ring-offset-slate-950 scale-[1.02]",
                           isMe && "opacity-50 grayscale cursor-not-allowed border-slate-800",
                           !isMe && !me?.vote && "hover:border-indigo-500 hover:bg-slate-800"
                        )}
                     >
                        <div className="absolute -top-3 flex gap-1 justify-center w-full z-20">
                           {hasVotedMe.map((voter, i) => (
                             <div key={i} className="w-8 h-8 rounded-full bg-rose-500 border-2 border-slate-950 flex items-center justify-center font-bold text-xs shadow-lg text-white font-mono">
                               {voter.name.charAt(0).toUpperCase()}
                             </div>
                           ))}
                        </div>

                        <div className="w-16 h-16 rounded-full bg-slate-800 mb-3 border-2 border-slate-700 flex items-center justify-center font-black text-2xl text-white">
                          {p.name.charAt(0).toUpperCase()}
                        </div>

                        <span className="font-bold text-sm truncate w-full text-center">{p.name}</span>
                        
                        {!p.vote ? (
                           <span className="text-[10px] text-amber-500 font-bold mt-2 animate-pulse uppercase tracking-tighter flex items-center gap-1">Yê biryarê dide</span>
                        ) : (
                           <span className="text-[10px] text-emerald-400 font-bold mt-2 uppercase tracking-tighter flex items-center gap-1">Deng da</span>
                        )}
                     </button>
                   )
                })}
             </div>
          </div>
        );
      case "result":
        const imposter = players.find(p => p.userId === room.imposterId);
        
        let imposterVotes = 0;
        const voteCounts: Record<string, number> = {};
        players.forEach(p => {
           if (p.vote) {
             voteCounts[p.vote] = (voteCounts[p.vote] || 0) + 1;
             if (p.vote === room.imposterId) imposterVotes++;
           }
        });
        let maxVotes = 0;
        Object.values(voteCounts).forEach(v => {
           if (v > maxVotes) maxVotes = v;
        });
        const caught = voteCounts[room.imposterId] === maxVotes && maxVotes > 0;

        if (caught && me?.userId !== room.imposterId) {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } else if (!caught && me?.userId === room.imposterId) {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }

        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center pt-8 overflow-y-auto">
             <h2 className="text-[10px] text-slate-500 font-black mb-8 uppercase tracking-[0.3em]">Encamên Geryanê</h2>
             
             <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-6">
               <div className="w-24 h-24 rounded-full border-4 border-rose-500 mx-auto flex items-center justify-center bg-slate-900 mb-4 shadow-[0_0_40px_rgba(244,63,94,0.3)]">
                  <span className="text-5xl font-black text-white">{imposter?.name.charAt(0).toUpperCase()}</span>
               </div>
               <p className="text-3xl font-black tracking-tighter mb-2">{imposter?.name}</p>
               <p className="text-rose-500 font-bold text-xs uppercase tracking-widest bg-rose-500/10 inline-block px-4 py-1.5 rounded-full border border-rose-500/20">Sextekar Bû!</p>
             </motion.div>

             <div className="bg-indigo-600/10 p-5 rounded-3xl border border-indigo-500/30 w-full max-w-sm mx-auto mb-6 shadow-inner text-center">
               <p className="text-slate-300 font-bold text-[10px] tracking-widest uppercase leading-relaxed">
                 {caught ? (
                   <>Yarîkeran sextekar dît!<br/><span className="text-emerald-400 font-black text-sm pt-2 block">Yarîker +3 Xal</span></>
                 ) : (
                   <>Sextekar xwe veşart!<br/><span className="text-rose-400 font-black text-sm pt-2 block">Sextekar +3 Xal</span></>
                 )}
               </p>
             </div>

             <div className="flex items-center gap-2 mb-6 bg-slate-900/50 px-4 py-2 rounded-full border border-white/5">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Geryana nû di</span>
                <span className="text-indigo-400 font-mono font-black text-sm">{Math.max(0, timeLeft)}s</span>
             </div>

             {/* Scoreboard Preview */}
             <div className="w-full bg-slate-900/80 rounded-3xl p-5 border border-white/5">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 border-b border-white/10 pb-3 text-left">Lîsteya Xalan</h3>
                <div className="space-y-2">
                {players.sort((a,b)=> b.score - a.score).map((p, i) => (
                  <div key={p.userId} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                       <div className={cn("w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px]", i===0 ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-slate-800 text-slate-400")}>
                          0{i+1}
                       </div>
                       <span className="font-bold text-xs truncate max-w-[120px] text-left">{p.name}</span>
                    </div>
                    <span className={cn("font-black text-sm", i===0 ? "text-indigo-400" : "text-slate-400")}>{p.score}</span>
                  </div>
                ))}
                </div>
             </div>
          </div>
        );
      case "finished":
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
             <h2 className="text-5xl font-black mb-2 text-white tracking-tighter">Dawiya Yariyê</h2>
             <p className="text-slate-400 text-[10px] font-bold tracking-[0.3em] uppercase mb-10">Encamên Dawî</p>
             
             <div className="w-full space-y-3 mb-8">
                {players.sort((a,b)=> b.score - a.score).map((p, i) => (
                  <div key={p.userId} className={cn("rounded-3xl p-4 flex justify-between items-center border", i===0 ? "bg-indigo-600/20 border-indigo-500/50 shadow-xl shadow-indigo-500/10 scale-105" : "bg-slate-900/50 border-white/5")}>
                     <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg", i===0 ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-500")}>
                           0{i+1}
                        </div>
                        <span className="font-bold text-lg">{p.name} {i === 0 && "🏆"}</span>
                     </div>
                     <span className={cn("text-2xl font-black", i===0 ? "text-indigo-400" : "text-slate-400")}>{p.score}</span>
                  </div>
                ))}
             </div>
             {isHost && (
                <button onClick={() => updateDoc(doc(db, "rooms", roomId), { status: "waiting", currentRound: 0 }).then(() => {
                  players.forEach(p => updateDoc(doc(db, "rooms", roomId, "players", p.userId), { score: 0, vote: deleteField() }));
                })} className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black text-lg tracking-wide hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 uppercase mt-auto">
                  Dîsa Bileyze
                </button>
             )}
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative z-10 w-full px-4">
       <div className="absolute top-0 right-4 z-50">
           {room?.status === "waiting" && (
             <button onClick={handleLeave} className="bg-rose-600/20 text-rose-500 hover:bg-rose-600 hover:text-white px-4 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-wide transition-all border border-rose-500/30">
                Derketin
             </button>
           )}
       </div>
       {renderContent()}
    </div>
  );
}
