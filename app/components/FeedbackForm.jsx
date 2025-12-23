'use client';

import { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';

export default function FeedbackForm() {
  const form = useRef();
  const [status, setStatus] = useState('IDLE'); // IDLE, SENDING, SUCCESS, ERROR
  const [decryptionProgress, setDecryptionProgress] = useState(0);
  const [subject, setSubject] = useState('FEATURE');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('SENDING');

    // Simulate "Decryption / Scrambling" animation
    const interval = setInterval(() => {
      setDecryptionProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 50);

    try {
      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID_CONTACT_US;
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

      if (serviceId && templateId && publicKey) {
        const formData = new FormData(form.current);
        await emailjs.send(
          serviceId,
          templateId,
          {
            from_name: formData.get('user_name'),
            reply_to: formData.get('user_email'),
            subject: subject,
            message: formData.get('message'),
          },
          publicKey
        );
      } else {
        console.warn('EmailJS environment variables are missing. Simulating transmission.');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      setStatus('SUCCESS');
      setSubject('FEATURE'); // Reset to default after success
    } catch (error) {
      console.error('Signal transmission failed:', error);
      setStatus('ERROR');
    } finally {
      setDecryptionProgress(0);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto p-1 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 rounded-[2rem] shadow-2xl">
      <div className="bg-[#0a0a0a] rounded-[1.9rem] p-8 md:p-12 border border-white/5 relative overflow-hidden group">
        {/* Decorative Grid Overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-500/80 font-mono">Feedback Interface v2.0.1</span>
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-white font-mono">
              {status === 'SUCCESS' ? 'FEEDBACK_LOGGED' : 'REQUEST_FEATURE'}
            </h3>
          </div>

          {status === 'SUCCESS' ? (
            <div className="py-20 text-center space-y-6 animate-fade-in">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                <span className="text-4xl text-emerald-500">✓</span>
              </div>
              <div className="space-y-2">
                <p className="text-xl font-bold font-mono text-emerald-400">DATA_SYNC_COMPLETE</p>
                <p className="text-gray-500 font-medium">Your request has been added to our development queue. We appreciate your input!</p>
              </div>
              <button
                onClick={() => setStatus('IDLE')}
                className="text-xs font-bold uppercase tracking-widest text-blue-500 hover:text-blue-400 transition"
              >
                ← Log Another Entry
              </button>
            </div>
          ) : (
            <form ref={form} onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="group/field relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-4 mb-2 block group-focus-within/field:text-blue-400 transition-colors">Explorer identity</label>
                  <input
                    required
                    name="user_name"
                    type="text"
                    placeholder="USERNAME_ID"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all font-mono text-sm"
                  />
                </div>

                <div className="group/field relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-4 mb-2 block group-focus-within/field:text-blue-400 transition-colors">Communication Node</label>
                  <input
                    required
                    name="user_email"
                    type="email"
                    placeholder="USER@VAULT.SECURE"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all font-mono text-sm"
                  />
                </div>

                <div className="group/field relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-4 mb-2 block group-focus-within/field:text-blue-400 transition-colors">Submission Type</label>
                  <select
                    name="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all font-mono text-sm appearance-none cursor-pointer"
                  >
                    <option value="FEATURE">REF: NEW_FEATURE_REQUEST</option>
                    <option value="IMPROVEMENT">REF: UI_UX_IMPROVEMENT</option>
                    <option value="BUG">REF: BUG_REPORT</option>
                    <option value="OTHER">REF: MISC_FEEDBACK</option>
                  </select>
                </div>

                <div className="group/field relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-4 mb-2 block group-focus-within/field:text-blue-400 transition-colors">Feature Specifications</label>
                  <textarea
                    required
                    name="message"
                    rows="4"
                    placeholder="DESCRIBE_YOUR_VISION..."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all font-mono text-sm resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="pt-4">
                <button
                  disabled={status === 'SENDING'}
                  type="submit"
                  className="w-full group/btn relative overflow-hidden rounded-2xl bg-white text-black py-4 font-bold font-mono transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    {status === 'SENDING' ? (
                      <>
                        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                        SYNCING_DATA {decryptionProgress}%
                      </>
                    ) : (
                      <>SUBMIT_REQUEST_</>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-blue-500 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                </button>
              </div>

              {status === 'ERROR' && (
                <p className="text-[10px] text-center font-bold text-red-500 uppercase tracking-widest animate-pulse">
                  Error: Protocol connection timeout. Please try again.
                </p>
              )}
            </form>
          )}

          <div className="pt-8 border-t border-white/5 flex items-center justify-between">
             <div className="flex gap-2">
               {[1,2,3].map(i => <div key={i} className="w-1 h-3 bg-white/10 rounded-full"></div>)}
             </div>
             <p className="text-[9px] text-gray-600 font-mono italic">END_OF_TRANSMISSION</p>
          </div>
        </div>
      </div>
    </div>
  );
}
