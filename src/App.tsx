import { useEffect, useState } from "react";
import { auth, signInWithGoogle, logout, testConnection } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import Home from "./components/Home";
import RoomContainer from "./components/RoomContainer";
import { LogOut } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(() => sessionStorage.getItem("roomId"));

  useEffect(() => {
    if (roomId) {
      sessionStorage.setItem("roomId", roomId);
    } else {
      sessionStorage.removeItem("roomId");
    }
  }, [roomId]);

  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white relative">
        <div className="fixed inset-0 z-0 bg-black bg-[url('/bg.png')] bg-cover bg-center opacity-70 pointer-events-none"></div>
        <p className="animate-pulse font-bold tracking-widest text-slate-400 uppercase text-xs z-10 relative">چاڤەڕێی ژوورێ...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white px-4 relative" dir="rtl">
        <div className="fixed inset-0 z-0 bg-black bg-[url('/bg.png')] bg-cover bg-center opacity-70 pointer-events-none"></div>
        <div className="max-w-md w-full text-center space-y-8 z-10 relative">
          <h1 className="text-6xl font-black tracking-tighter text-white drop-shadow-md">
            مروفي <span className="text-red-500">دره وين</span>
          </h1>
          <p className="text-slate-400 text-lg font-medium tracking-wide">
            بۆ دەستپێکرنێ ب گووگڵ پشکدار بە
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg tracking-wide transition-all hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-indigo-500/20"
          >
            ب گووگڵ پشکدار بە
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30 flex flex-col overflow-hidden relative">
      <div className="fixed inset-0 z-0 bg-black bg-[url('/bg.png')] bg-cover bg-center opacity-70 pointer-events-none"></div>
      {roomId ? (
        <RoomContainer roomId={roomId} onLeave={() => setRoomId(null)} />
      ) : (
        <div className="flex-1 flex flex-col md:px-0 px-4 py-8 max-w-md mx-auto w-full h-full relative z-10" dir="rtl">
          <div className="flex items-center justify-between mb-8 bg-slate-900/80 backdrop-blur-md border border-white/10 p-4 rounded-3xl">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 border-2 border-indigo-500 shrink-0">
                 {user.photoURL && <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />}
               </div>
               <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">پشکدار بووی وەک</p>
                  <p className="text-base font-bold leading-none mt-1">{user.displayName || "یاریزان"}</p>
               </div>
            </div>
            <button onClick={logout} className="bg-rose-600/20 text-rose-500 hover:bg-rose-600 hover:text-white px-4 py-2 rounded-full font-bold text-xs tracking-wide transition-all border border-rose-500/30">
              دەرکەفتن
            </button>
          </div>

          <div className="flex-1 flex flex-col">
            <Home onJoin={(id) => setRoomId(id)} />
          </div>
        </div>
      )}
    </div>
  );
}
