import React, { useState } from "react";
import { CATEGORIES } from "../constants";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, ArrowLeft } from "lucide-react";

export default function Home({ onJoin }: { onJoin: (roomId: string) => void }) {
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  
  const [username, setUsername] = useState(auth.currentUser?.displayName || "Yarîker");
  const [categoryId, setCategoryId] = useState("xwarin");
  const [rounds, setRounds] = useState(5);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let text = "";
    for (let i = 0; i < 5; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || loading) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const roomId = generateCode();

      await setDoc(doc(db, "rooms", roomId), {
        hostId: auth.currentUser!.uid,
        code: roomId,
        status: "waiting",
        category: categoryId,
        totalRounds: rounds,
        currentRound: 0,
        createdAt: Date.now()
      });

      await setDoc(doc(db, "rooms", roomId, "players", auth.currentUser!.uid), {
        userId: auth.currentUser!.uid,
        name: username,
        score: 0,
        joinedAt: Date.now()
      });

      onJoin(roomId);
    } catch (error) {
      setErrorMsg("سه رفه جووو.");
      handleFirestoreError(error, OperationType.CREATE, "rooms");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!username.trim() || !code || loading) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const roomRef = doc(db, "rooms", code);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
         setErrorMsg("ج تشتي هوسا نينه.");
         setLoading(false);
         return;
      }

      const roomData = roomSnap.data();
      if (roomData.status !== "waiting") {
         setErrorMsg("ياري ده ربازبو.");
         setLoading(false);
         return;
      }

      await setDoc(doc(db, "rooms", code, "players", auth.currentUser!.uid), {
        userId: auth.currentUser!.uid,
        name: username,
        score: 0,
        joinedAt: Date.now()
      });

      onJoin(code);
    } catch (error) {
      setErrorMsg("سه رفه جووو.");
      handleFirestoreError(error, OperationType.GET, "rooms");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center pb-20">
      <AnimatePresence mode="wait">
        {mode === "menu" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="text-center mb-12">
              <h1 className="text-6xl font-black tracking-tighter text-white drop-shadow-md">
                ساختە<span className="text-red-500">کار</span>
              </h1>
              <p className="text-slate-400 mt-2 text-lg font-bold tracking-wide">کێ ژ مە ساختەکارە؟</p>
            </div>
            
            <button
              onClick={() => setMode("create")}
              className="w-full relative group overflow-hidden bg-indigo-600 text-white p-5 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-indigo-500/20"
            >
              <div className="font-black text-xl tracking-wide uppercase">ژوورەکێ چێبکە</div>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                <Plus size={24} />
              </div>
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full relative group overflow-hidden bg-slate-900/80 border border-white/10 text-white p-5 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98] hover:border-indigo-500"
            >
              <div className="font-black text-xl tracking-wide uppercase">پشکدار بە</div>
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                <Users size={24} />
              </div>
            </button>
          </motion.div>
        )}

        {mode === "create" && (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <button
              onClick={() => setMode("menu")}
              className="flex items-center gap-2 text-slate-500 hover:text-white mb-6 font-bold uppercase text-xs tracking-widest transition-colors"
            >
              <ArrowLeft size={16} /> ڤەگەڕە
            </button>
            <form onSubmit={handleCreate} className="space-y-6 bg-slate-900/50 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl shadow-indigo-500/10">
              <h2 className="text-3xl font-black mb-4 tracking-tighter">رێکخستنێن ژوورێ</h2>
              
              <div>
                <label className="block text-[10px] text-right font-black uppercase tracking-[0.2em] text-slate-500 mb-2">ناڤێ تە</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-4 font-black text-right focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
                  placeholder="ناڤێ خۆ بنڤیسە..."
                  maxLength={15}
                />
              </div>

              <div>
                <label className="block text-[10px] text-right font-black uppercase tracking-[0.2em] text-slate-500 mb-2">جورێ پەیڤان</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-4 font-black focus:outline-none text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner bg-right pr-10"
                  dir="rtl"
                >
                  {Object.values(CATEGORIES).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-right font-black uppercase tracking-[0.2em] text-slate-500 mb-2">گەڕ: {rounds}</label>
                <input
                  type="range"
                  min="3" max="10"
                  value={rounds}
                  onChange={(e) => setRounds(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  dir="ltr"
                />
              </div>

              {errorMsg && <p className="text-red-500 text-sm font-bold bg-red-500/10 p-3 text-right rounded-lg border border-red-500/20">{errorMsg}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white p-4 rounded-xl font-black text-lg tracking-wide hover:bg-indigo-500 transition-all disabled:opacity-50 mt-4 shadow-lg shadow-indigo-500/20 uppercase"
              >
                {loading ? "چێدکەت..." : "دەستپێبکە"}
              </button>
            </form>
          </motion.div>
        )}

        {mode === "join" && (
          <motion.div
            key="join"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <button
               onClick={() => setMode("menu")}
               className="flex items-center gap-2 text-slate-500 hover:text-white mb-6 font-bold uppercase text-xs tracking-widest transition-colors"
             >
               <ArrowLeft size={16} /> ڤەگەڕە
             </button>
             <form onSubmit={handleJoin} className="space-y-6 bg-slate-900/50 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl shadow-indigo-500/10">
               <h2 className="text-3xl font-black text-right mb-4 tracking-tighter">پشکدار بە</h2>
               
               <div>
                 <label className="block text-[10px] text-right font-black uppercase tracking-[0.2em] text-slate-500 mb-2">ناڤێ تە</label>
                 <input
                   type="text"
                   value={username}
                   onChange={(e) => setUsername(e.target.value)}
                   className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-4 font-black text-right focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
                   placeholder="ناڤێ خۆ بنڤیسە..."
                   maxLength={15}
                 />
               </div>

               <div>
                 <label className="block text-[10px] text-right font-black uppercase tracking-[0.2em] text-slate-500 mb-2">کۆدێ ژوورێ</label>
                 <input
                   type="text"
                   value={roomCode}
                   onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                   className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-4 font-black text-center text-3xl tracking-[0.3em] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all uppercase shadow-inner"
                   placeholder="XXXXX"
                   maxLength={5}
                   dir="ltr"
                 />
               </div>

               {errorMsg && <p className="text-red-500 text-sm font-bold bg-red-500/10 p-3 text-right rounded-lg border border-red-500/20">{errorMsg}</p>}

               <button
                 type="submit"
                 disabled={loading}
                 className="w-full bg-indigo-600 text-white p-4 rounded-xl font-black text-lg tracking-wide hover:bg-indigo-500 transition-all disabled:opacity-50 mt-4 shadow-lg shadow-indigo-500/20 uppercase"
               >
                 {loading ? "پشکدار دبیت..." : "پشکدار بە"}
               </button>
             </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
