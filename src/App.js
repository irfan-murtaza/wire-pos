import React, { useEffect, useState } from 'react';
import ReceiptForm from './ReceiptForm';
import AuthForm from './AuthForm';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  if (!user) return <AuthForm />;

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">AAF Cables</h1>
          <button onClick={() => signOut(auth)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md shadow-sm transition-all">Logout</button>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md">
          <ReceiptForm />
        </div>
      </div>
    </div>
  );
}

export default App;