
import React, { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from 'react-markdown';
import { Edit, Eye } from 'lucide-react';

// Custom checkbox component that handles clicks
const InteractiveCheckbox = ({ checked, onChange, children }) => {
  return (
    <li className="flex items-start gap-2 my-2 list-none">
      <button
        type="button"
        onClick={onChange}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors ${
          checked 
            ? 'bg-blue-500 border-blue-500 text-white' 
            : 'border-gray-400 dark:border-gray-500 hover:border-blue-400'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      <span className={`flex-1 ${checked ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
        {children}
      </span>
    </li>
  );
};

export default function ProjectFileEditor({ value, onChange }) {
  const [activeTab, setActiveTab] = useState('edit');

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const { selectionStart, selectionEnd } = e.currentTarget;
      const currentValue = e.currentTarget.value;
      
      const textBefore = currentValue.substring(0, selectionStart);
      const textAfter = currentValue.substring(selectionEnd);
      
      const newValue = `${textBefore}\n- [ ] ${textAfter}`;
      
      onChange(newValue);

      setTimeout(() => {
        if (e.target) {
          const newCursorPosition = selectionStart + 7;
          e.target.selectionStart = newCursorPosition;
          e.target.selectionEnd = newCursorPosition;
        }
      }, 0);
    }
  }, [onChange]);

  const handleCheckboxToggle = useCallback((lineIndex) => {
    const lines = value.split('\n');
    if (lines[lineIndex]) {
      const line = lines[lineIndex];
      // Toggle between - [ ] and - [x]
      if (line.includes('- [ ]')) {
        lines[lineIndex] = line.replace('- [ ]', '- [x]');
      } else if (line.includes('- [x]')) {
        lines[lineIndex] = line.replace('- [x]', '- [ ]');
      }
      onChange(lines.join('\n'));
    }
  }, [value, onChange]);

  // Custom components for ReactMarkdown
  const components = {
    li: ({ children, ...props }) => {
      // Check if this is a task list item
      const content = children?.toString() || '';
      
      // Handle task list items specifically
      if (typeof children === 'object' && Array.isArray(children)) {
        const firstChild = children[0];
        if (typeof firstChild === 'object' && firstChild?.props?.type === 'checkbox') {
          const checked = firstChild.props.checked;
          const textContent = children.slice(1); // Get everything after the checkbox
          
          // Find which line this checkbox corresponds to
          const lines = value.split('\n');
          let lineIndex = -1;
          
          // Try to match the text content to find the right line
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('- [ ]') || line.includes('- [x]')) {
              const lineText = line.replace(/^\s*-?\s*\[.\]\s*/, '').trim();
              const contentText = Array.isArray(textContent) ? 
                                  textContent.map(node => typeof node === 'object' && node !== null && 'props' in node ? node.props.children : node)
                                             .flat(Infinity)
                                             .join('')
                                             .trim() : 
                                  String(textContent).trim();
              
              if (lineText === contentText) {
                lineIndex = i;
                break;
              }
            }
          }
          
          return (
            <InteractiveCheckbox 
              checked={checked} 
              onChange={() => handleCheckboxToggle(lineIndex)}
            >
              {textContent}
            </InteractiveCheckbox>
          );
        }
      }
      
      // Regular list item
      return <li {...props}>{children}</li>;
    },
    // Hide the default input checkbox since we're replacing it
    input: ({ type, ...props }) => {
      if (type === 'checkbox') {
        return null; // We handle checkboxes in the li component
      }
      return <input type={type} {...props} />;
    },
    // Custom styling for different elements
    h1: ({ children, ...props }) => (
      <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-white" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-white" {...props}>
        {children}
      </h3>
    ),
    p: ({ children, ...props }) => (
      <p className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" {...props}>
        {children}
      </p>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-blue-50 dark:bg-blue-900/20 text-gray-700 dark:text-gray-300 italic" {...props}>
        {children}
      </blockquote>
    ),
    code: ({ inline, children, ...props }) => {
      if (inline) {
        return (
          <code className="bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 px-1 py-0.5 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }
      return (
        <code className="block bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm whitespace-pre-wrap" {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children, ...props }) => (
      <pre className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 rounded-lg overflow-x-auto mb-4 font-mono text-sm" {...props}>
        {children}
      </pre>
    ),
    a: ({ children, href, ...props }) => (
      <a 
        href={href} 
        className="text-blue-600 dark:text-blue-400 hover:underline" 
        target="_blank" 
        rel="noopener noreferrer" 
        {...props}
      >
        {children}
      </a>
    ),
    img: ({ src, alt, ...props }) => (
      <img 
        src={src} 
        alt={alt} 
        className="max-w-full h-auto rounded-lg shadow-sm mb-4" 
        {...props} 
      />
    ),
    hr: ({ ...props }) => (
      <hr className="border-gray-300 dark:border-gray-600 my-6" {...props} />
    ),
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-6">
        <table className="min-w-full border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-gray-100 dark:bg-gray-800" {...props}>
        {children}
      </thead>
    ),
    tbody: ({ children, ...props }) => (
      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700" {...props}>
        {children}
      </tbody>
    ),
    tr: ({ children, ...props }) => (
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50" {...props}>
        {children}
      </tr>
    ),
    th: ({ children, ...props }) => (
      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b-2 border-gray-200 dark:border-gray-700" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 align-top" {...props}>
        {children}
      </td>
    ),
    ul: ({ children, ...props }) => (
      <ul className="mb-4 pl-6 space-y-1" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="mb-4 pl-6 space-y-1 list-decimal" {...props}>
        {children}
      </ol>
    )
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Quest To-Do List</Label>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="pt-4">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="- [ ] Your first task..."
            rows={12}
            className="bg-white border-gray-200 text-gray-900 resize-none font-mono text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Use markdown for checklists. Press Enter to create a new task.
          </p>
        </TabsContent>
        <TabsContent value="preview" className="pt-4">
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-x-auto min-h-[290px]">
            <ReactMarkdown 
              className="text-gray-800 dark:text-gray-200 prose dark:prose-invert max-w-none"
              components={components}
            >
              {value || "No content to preview."}
            </ReactMarkdown>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
