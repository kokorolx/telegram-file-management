import fs from 'fs';
import path from 'path';
import Link from 'next/link';

import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

// Helper to parse markdown content into structured data
function parseChangelog(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;
  let currentSubSection = null;

  lines.forEach(line => {
    const trimmed = line.trim();

    if (!trimmed) return;

    if (trimmed.startsWith('## ')) {
      // New version section
      if (currentSection) {
        if (currentSubSection) {
          currentSection.subSections.push(currentSubSection);
          currentSubSection = null;
        }
        sections.push(currentSection);
      }

      const title = trimmed.replace('## ', '');
      const dateMatch = title.match(/\[(.*?)\]/);
      const date = dateMatch ? dateMatch[1] : '';
      const cleanTitle = title.replace(/\[.*?\]\s*-\s*/, '').trim();

      currentSection = {
        date,
        title: cleanTitle,
        subSections: []
      };
    } else if (trimmed.startsWith('### ')) {
      // Subsection (e.g., New Features, Security)
      if (currentSubSection && currentSection) {
        currentSection.subSections.push(currentSubSection);
      }
      currentSubSection = {
        title: trimmed.replace('### ', ''),
        items: []
      };
    } else if (trimmed.startsWith('- ')) {
      // List item
      const itemContent = trimmed.replace('- ', '');
      // Parse bold text like **Text**
      const parts = itemContent.split('**');
      const item = {
        highlight: parts.length > 1 ? parts[1] : '',
        text: parts.length > 2 ? parts[2].replace(/^\s*-\s*/, '') : parts[0]
      };

      if (currentSubSection) {
        currentSubSection.items.push({ type: 'bullet', ...item });
      } else if (currentSection) {
         // Fallback if no subsection
         // create a default one or just ignore? let's ignore for now or add to a misc
      }
    } else if (/^\d+\./.test(trimmed)) {
      // Numbered list
       const itemContent = trimmed.replace(/^\d+\.\s*/, '');
       if (currentSubSection) {
        currentSubSection.items.push({ type: 'number', text: itemContent });
      }
    } else if (trimmed.startsWith('---')) {
       // Separator, ignore
    } else if (trimmed.startsWith('# ')) {
       // Main title, ignore
    } else {
      // Paragraph text
      if (currentSubSection) {
         currentSubSection.items.push({ type: 'text', text: trimmed });
      } else if (currentSection) {
         // Description for the version?
         if (!currentSection.description) currentSection.description = [];
         currentSection.description.push(trimmed);
      }
    }
  });

  // Push last ones
  if (currentSubSection && currentSection) {
    currentSection.subSections.push(currentSubSection);
  }
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

export default async function ChangelogPage() {
  const filePath = path.join(process.cwd(), 'PUBLIC_CHANGELOG.md');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const changes = parseChangelog(fileContent);

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
              What's New
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Updates, improvements, and security enhancements
            </p>
          </div>

          {/* Timeline */}
          <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-500/50 before:via-slate-500/50 before:to-transparent">

            {changes.map((change, index) => (
              <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-fade-in-smooth" style={{ animationDelay: `${index * 100}ms` }}>

                {/* Dot */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-blue-500 bg-blue-500/20 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-xl">
                  {change.subSections[0]?.title.includes('Security') ? '🔒' :
                   change.subSections[0]?.title.includes('Features') ? '✨' : '🚀'}
                </div>

                {/* Content Card */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-2xl hover:shadow-md transition-all duration-300 bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                    <h2 className="text-xl font-bold text-white">{change.title || 'Update'}</h2>
                    <span className="px-3 py-1 text-xs font-semibold text-blue-400 bg-blue-500/20 rounded-full whitespace-nowrap self-start border border-blue-500/30">
                      {change.date}
                    </span>
                  </div>

                  {change.description && change.description.length > 0 && (
                    <div className="mb-4 text-slate-400 space-y-2 text-sm italic">
                      {change.description.map((desc, i) => <p key={i}>{desc}</p>)}
                    </div>
                  )}

                  <div className="space-y-6">
                    {change.subSections.map((section, secIdx) => (
                      <div key={secIdx}>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                         {section.title}
                        </h3>
                        <ul className="space-y-3">
                          {section.items.map((item, itemIdx) => (
                            <li key={itemIdx} className="text-sm text-slate-300 leading-relaxed flex gap-2">
                              {item.type === 'bullet' && (
                                <>
                                  <span className="text-blue-400 shrink-0 mt-1">•</span>
                                  <span>
                                    {item.highlight && <strong className="text-blue-300 font-semibold">{item.highlight}</strong>}
                                    {item.highlight && item.text ? ' - ' : ''}
                                    {item.text}
                                  </span>
                                </>
                              )}
                              {item.type === 'number' && (
                                <span className="flex gap-2">
                                  <span className="font-mono text-slate-500 font-bold shrink-0">{itemIdx + 1}.</span>
                                  <span>{item.text}</span>
                                </span>
                              )}
                              {item.type === 'text' && (
                                <p className="text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 text-xs leading-5">
                                  {item.text}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

          </div>

          <div className="text-center pt-12 pb-4">
             <Link href="/" className="inline-flex items-center justify-center px-6 py-3 border border-blue-500 text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200">
                Start Using Telegram Vault
             </Link>
          </div>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
