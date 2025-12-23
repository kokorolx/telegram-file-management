import fs from 'fs';
import path from 'path';
import Link from 'next/link';

import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import FeedbackForm from '../components/FeedbackForm';

// Helper to parse roadmap content from PUBLIC_CHANGELOG.md
function parseRoadmap(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;
  let inUpcomingFeatures = false;

  lines.forEach(line => {
    const trimmed = line.trim();

    if (!trimmed) return;

    if (trimmed.startsWith('## Upcoming Features')) {
      inUpcomingFeatures = true;
      return;
    }

    if (inUpcomingFeatures) {
      if (trimmed.startsWith('## ') && !trimmed.startsWith('## Upcoming Features')) {
        // Exit when another version section starts (though Upcoming Features is usually at the end)
        inUpcomingFeatures = false;
        return;
      }

      if (trimmed.startsWith('### ')) {
        // Subsection (e.g., In Development, Future Roadmap)
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: trimmed.replace('### ', ''),
          items: []
        };
      } else if (trimmed.startsWith('- [ ] ')) {
        // Roadmap item
        const itemContent = trimmed.replace('- [ ] ', '');
        // Parse bold text like **Text**
        const parts = itemContent.split('**');
        const item = {
          highlight: parts.length > 1 ? parts[1] : '',
          text: parts.length > 2 ? parts[2].replace(/^\s*-\s*/, '') : parts[0]
        };

        if (currentSection) {
          currentSection.items.push(item);
        }
      }
    }
  });

  // Push last one
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

export default async function RoadmapPage() {
  const filePath = path.join(process.cwd(), 'PUBLIC_CHANGELOG.md');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const roadmap = parseRoadmap(fileContent);

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-white selection:bg-blue-500/30">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <PublicHeader />

      <main className="relative flex-grow pt-24 pb-16 px-4 sm:px-6 lg:px-8 z-10">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4 tracking-tight">
              Product Roadmap
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Discover what we're building next for the future of secure storage
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {roadmap.map((section, index) => (
              <div
                key={index}
                className="bg-slate-900/40 border border-slate-800/50 backdrop-blur-md rounded-3xl p-8 hover:border-blue-500/30 transition-all duration-300 group"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">{section.title.split(' ')[0]}</span>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {section.title.replace(/^[^\s]+\s/, '')}
                  </h2>
                </div>

                <ul className="space-y-6">
                  {section.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="flex gap-4 group/item">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 group-hover/item:scale-150 transition-transform duration-300 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                      <div>
                        {item.highlight && (
                          <span className="block text-sm font-bold text-blue-300 mb-1 tracking-wide uppercase">
                            {item.highlight}
                          </span>
                        )}
                        <p className="text-slate-400 text-sm leading-relaxed group-hover/item:text-slate-300 transition-colors">
                          {item.text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Feedback Form Section */}
          <div className="mt-20 space-y-12">
            <div className="text-center space-y-4">
              <h3 className="text-3xl font-bold">Have a feature request?</h3>
              <p className="text-slate-400 max-w-md mx-auto">
                We're building Telegram Vault for you. Let us know what features you'd like to see next.
              </p>
            </div>

            <FeedbackForm />
          </div>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
