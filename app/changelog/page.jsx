'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { useRouter } from 'next/navigation';

// Parse inline markdown formatting (bold, code, links, italic)
function parseInlineMarkdown(text) {
  const parts = [];
  let i = 0;

  while (i < text.length) {
    // Bold text **text**
    if (text.substr(i, 2) === '**') {
      const endIndex = text.indexOf('**', i + 2);
      if (endIndex !== -1) {
        parts.push({
          type: 'bold',
          content: text.slice(i + 2, endIndex),
        });
        i = endIndex + 2;
        continue;
      }
    }

    // Italic text *text* (but not **)
    if (text[i] === '*' && text[i + 1] !== '*' && text[i - 1] !== '*') {
      const endIndex = text.indexOf('*', i + 1);
      if (endIndex !== -1 && text[endIndex + 1] !== '*') {
        parts.push({
          type: 'italic',
          content: text.slice(i + 1, endIndex),
        });
        i = endIndex + 1;
        continue;
      }
    }

    // Code text `code`
    if (text[i] === '`') {
      const endIndex = text.indexOf('`', i + 1);
      if (endIndex !== -1) {
        parts.push({
          type: 'code',
          content: text.slice(i + 1, endIndex),
        });
        i = endIndex + 1;
        continue;
      }
    }

    // Links [text](url)
    if (text[i] === '[') {
      const endBracket = text.indexOf(']', i);
      if (endBracket !== -1 && text[endBracket + 1] === '(') {
        const endParen = text.indexOf(')', endBracket);
        if (endParen !== -1) {
          parts.push({
            type: 'link',
            text: text.slice(i + 1, endBracket),
            url: text.slice(endBracket + 2, endParen),
          });
          i = endParen + 1;
          continue;
        }
      }
    }

    // Regular text
    let nextSpecial = text.length;
    const positions = [
      text.indexOf('**', i + 1),
      text.indexOf('*', i + 1),
      text.indexOf('`', i + 1),
      text.indexOf('[', i + 1),
    ].filter(p => p !== -1);

    if (positions.length > 0) {
      nextSpecial = Math.min(...positions);
    }

    const content = text.slice(i, nextSpecial);
    if (content) {
      if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
        parts[parts.length - 1].content += content;
      } else {
        parts.push({
          type: 'text',
          content,
        });
      }
    }

    i = nextSpecial;
  }

  return parts;
}

// Render inline markdown parts
function renderInlineMarkdown(parts) {
  return parts.map((part, idx) => {
    switch (part.type) {
      case 'bold':
        return (
          <strong key={idx} className="font-bold text-white">
            {renderInlineMarkdown(parseInlineMarkdown(part.content))}
          </strong>
        );
      case 'italic':
        return (
          <em key={idx} className="italic">
            {renderInlineMarkdown(parseInlineMarkdown(part.content))}
          </em>
        );
      case 'code':
        return (
          <code key={idx} className="bg-gray-800 px-2 py-1 rounded text-sm font-mono text-blue-300">
            {part.content}
          </code>
        );
      case 'link':
        return (
          <a
            key={idx}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {part.text}
          </a>
        );
      case 'text':
      default:
        return part.content;
    }
  });
}

// Simple markdown parser for changelog
function parseMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;
  let inList = false;
  let listItems = [];

  while (i < lines.length) {
    const line = lines[i];

    // Headers
    if (line.startsWith('# ')) {
      if (inList) {
        elements.push({
          type: 'ul',
          items: listItems,
        });
        listItems = [];
        inList = false;
      }
      elements.push({
        type: 'h1',
        content: line.slice(2),
      });
    } else if (line.startsWith('## ')) {
      if (inList) {
        elements.push({
          type: 'ul',
          items: listItems,
        });
        listItems = [];
        inList = false;
      }
      elements.push({
        type: 'h2',
        content: line.slice(3),
      });
    } else if (line.startsWith('### ')) {
      if (inList) {
        elements.push({
          type: 'ul',
          items: listItems,
        });
        listItems = [];
        inList = false;
      }
      elements.push({
        type: 'h3',
        content: line.slice(4),
      });
    } else if (line.startsWith('#### ')) {
      if (inList) {
        elements.push({
          type: 'ul',
          items: listItems,
        });
        listItems = [];
        inList = false;
      }
      elements.push({
        type: 'h4',
        content: line.slice(5),
      });
    }
    // Horizontal rule
    else if (line.trim() === '---') {
      if (inList) {
        elements.push({
          type: 'ul',
          items: listItems,
        });
        listItems = [];
        inList = false;
      }
      elements.push({
        type: 'hr',
      });
    }
    // List items
    else if (line.startsWith('- ')) {
      inList = true;
      listItems.push(line.slice(2));
    }
    // Numbered list
    else if (/^\d+\. /.test(line)) {
      if (inList) {
        elements.push({
          type: 'ul',
          items: listItems,
        });
        listItems = [];
        inList = false;
      }
      const content = line.replace(/^\d+\. /, '');
      elements.push({
        type: 'ol-item',
        content,
      });
    }
    // Empty line
    else if (line.trim() === '') {
      if (inList) {
        elements.push({
          type: 'ul',
          items: listItems,
        });
        listItems = [];
        inList = false;
      }
    }
    // Regular paragraph
    else if (line.trim()) {
      if (inList) {
        elements.push({
          type: 'ul',
          items: listItems,
        });
        listItems = [];
        inList = false;
      }
      elements.push({
        type: 'p',
        content: line,
      });
    }

    i++;
  }

  if (inList) {
    elements.push({
      type: 'ul',
      items: listItems,
    });
  }

  return elements;
}

function renderMarkdownElement(element, index) {
  switch (element.type) {
    case 'h1':
      return (
        <h1 key={index} className="text-5xl md:text-6xl font-extrabold tracking-tight mb-8 text-white">
          {renderInlineMarkdown(parseInlineMarkdown(element.content))}
        </h1>
      );
    case 'h2':
      return (
        <h2 key={index} className="text-3xl font-bold mt-12 mb-6 text-white border-b border-white/10 pb-3">
          {renderInlineMarkdown(parseInlineMarkdown(element.content))}
        </h2>
      );
    case 'h3':
      return (
        <h3 key={index} className="text-xl font-bold mt-6 mb-4 text-blue-400">
          {renderInlineMarkdown(parseInlineMarkdown(element.content))}
        </h3>
      );
    case 'h4':
      return (
        <h4 key={index} className="text-lg font-semibold mt-4 mb-3 text-gray-300">
          {renderInlineMarkdown(parseInlineMarkdown(element.content))}
        </h4>
      );
    case 'hr':
      return <hr key={index} className="my-12 border-white/10" />;
    case 'ul':
      return (
        <ul key={index} className="mb-6 space-y-2 ml-6 text-gray-300">
          {element.items.map((item, i) => (
            <li key={i} className="list-disc">
              {renderInlineMarkdown(parseInlineMarkdown(item))}
            </li>
          ))}
        </ul>
      );
    case 'ol-item':
      return (
        <div key={index} className="mb-3 ml-6 text-gray-300">
          {renderInlineMarkdown(parseInlineMarkdown(element.content))}
        </div>
      );
    case 'p':
      return (
        <p key={index} className="mb-4 text-gray-300 leading-relaxed">
          {renderInlineMarkdown(parseInlineMarkdown(element.content))}
        </p>
      );
    default:
      return null;
  }
}

export default function ChangelogPage() {
  const router = useRouter();
  const [changelog, setChangelog] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        const response = await fetch('/api/changelog');
        if (!response.ok) {
          throw new Error('Failed to fetch changelog');
        }
        const text = await response.text();
        setChangelog(text);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChangelog();
  }, []);

  const elements = changelog ? parseMarkdown(changelog) : [];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Navigation */}
      <PublicHeader onLaunch={() => router.push('/?login=true')} activePage="changelog" />

      <main className="relative pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-6 mb-8">
              <p className="text-red-200">Error loading changelog: {error}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {elements.map((element, index) => renderMarkdownElement(element, index))}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
