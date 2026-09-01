import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents: Components = {
  a({ href, children }) {
    return (
      <a href={href} rel="noreferrer noopener" target="_blank">
        {children}
      </a>
    );
  },
};

export function AssistantMarkdown({ children }: { children: string }) {
  return (
    <div className="assistant-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
