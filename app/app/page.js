"use client";
import { useState } from 'react';
import { ArrowRight, Sparkles, Youtube, Loader2 } from 'lucide-react';
import ResultCard from './components/ResultCard';

export default function Home() {
  const [manualText, setManualText] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    setStatus('영상 분석 중...');

    try {
      const body = { url };
      if (showManualInput && manualText) {
        body.manualTranscript = manualText;
      }

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // If specific error, show manual input
        if (data.error && (data.error.includes("자막") || data.error.includes("Transcript"))) {
          setShowManualInput(true);
          throw new Error("자막을 가져올 수 없는 영상입니다. 내용을 직접 입력해주세요.");
        }
        throw new Error(data.error || '오류가 발생했습니다.');
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <main className="premium-bg flex flex-col items-center justify-center min-h-screen p-4 sm:p-24 overflow-hidden">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-12">
        <div className="fixed left-0 top-0 flex w-full justify-center border-b border-white/10 bg-black/20 backdrop-blur-md pb-6 pt-8 lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200/5 lg:p-4">
          <code className="font-mono font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-yellow-400" /> YouTube to Blog AI
          </code>
        </div>
      </div>

      <div className="relative flex flex-col items-center justify-center text-center z-10 w-full max-w-3xl">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
          유튜브 영상을 <br />
          <span className="text-gradient">블로그 포스팅으로</span>
        </h1>
        <p className="text-lg text-gray-400 mb-10 max-w-lg mx-auto">
          링크만 넣으세요. AI가 영상을 분석하고, 구조를 잡고, 스크린샷까지 캡처하여
          완벽한 네이버 블로그 글을 만들어드립니다.
        </p>

        <form onSubmit={handleSubmit} className="w-full relative group space-y-4">
          <div className="relative flex items-center bg-black/80 rounded-xl border border-white/10 p-2 shadow-2xl">
            <div className="pl-4 pr-2 text-gray-500">
              <Youtube size={24} />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="유튜브 링크를 여기에 붙여넣으세요..."
              className="w-full bg-transparent text-white p-4 focus:outline-none placeholder-gray-500 text-lg"
              required={!showManualInput}
            />
            {/* Submit button logic moved below if needed, or keep here */}
            {!showManualInput && (
              <button
                type="submit"
                disabled={loading}
                className="bg-white text-black hover:bg-gray-200 disabled:bg-gray-500 disabled:cursor-not-allowed font-bold py-3 px-8 rounded-lg transition-all duration-300 flex items-center gap-2 whitespace-nowrap"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
              </button>
            )}
          </div>

          {showManualInput && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-black/60 rounded-xl border border-yellow-500/30 p-4 shadow-2xl backdrop-blur-md">
                <div className="text-left mb-2 text-yellow-500 text-sm font-bold flex items-center gap-2">
                  ⚠️ 자막을 가져올 수 없습니다. 내용을 직접 입력해주세요.
                </div>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="영상 내용 요약이나 자막을 여기에 붙여넣으세요..."
                  className="w-full bg-black/40 text-white p-4 rounded-lg focus:outline-none border border-white/10 min-h-[200px]"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 w-full bg-yellow-500 text-black hover:bg-yellow-400 font-bold py-4 px-8 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>분석 중...</span>
                    </>
                  ) : (
                    <>
                      <span>직접 입력한 내용으로 생성하기</span>
                      <Sparkles size={20} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>

        {error && !showManualInput && (
          <div className="mt-8 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-200 w-full max-w-lg animate-pulse">
            ⚠️ {error}
          </div>
        )}

        {result && <ResultCard content={result.markdown} images={result.images} />}
      </div>
    </main>
  );
}
