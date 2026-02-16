"use client";
import ReactMarkdown from 'react-markdown';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export default function ResultCard({ content, images }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card rounded-2xl p-8 w-full max-w-4xl mx-auto mt-8 animate-float text-left">
      <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">✨</span> 생성된 블로그 초안
        </h2>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-medium shadow-lg hover:shadow-indigo-500/30"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? '복사됨!' : '전체 복사'}
        </button>
      </div>

      <div className="prose prose-invert max-w-none">
        <ReactMarkdown
            components={{
                img: ({node, ...props}) => {
                    // Try to find a matching captured image if the src looks like a timestamp or placeholder
                    // For now, we assume the markdown contains standard image links or we might need to inject them.
                    // Actually, let's just render them as is, but style them nicely.
                    return (
                        <div className="my-4 relative group">
                            <img {...props} className="rounded-lg shadow-lg max-w-full h-auto" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                <span className="text-white font-medium">Click to view full size</span>
                            </div>
                        </div>
                    )
                }
            }}
        >
            {content}
        </ReactMarkdown>
      </div>
      
      {images && images.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-700">
           <h3 className="text-xl font-semibold text-white mb-4">📸 캡처된 이미지 (우클릭하여 저장)</h3>
           <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((img, idx) => (
                  <img key={idx} src={img} alt={`Capture ${idx}`} className="rounded-lg hover:scale-105 transition-transform duration-300 cursor-pointer border border-gray-700" />
              ))}
           </div>
        </div>
      )}
    </div>
  );
}
