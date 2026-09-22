import React from 'react';

/**
 * Trình render Markdown tối giản cho câu trả lời của trợ lý AI.
 *
 * Model được yêu cầu trả lời bằng markdown (xem CHAT_RESPONSE_SCHEMA trong
 * server/domain/prompts.ts), nên nếu in thẳng nội dung ra thì du khách sẽ thấy các dấu **
 * và - còn nguyên trên màn hình. Ở đây chỉ hỗ trợ đúng tập cú pháp mà prompt yêu
 * cầu — tiêu đề, bullet, danh sách số, in đậm, in nghiêng, mã inline và liên kết —
 * thay vì kéo thêm một thư viện markdown đầy đủ vào bundle.
 *
 * Mọi thứ được dựng bằng React element, không dùng dangerouslySetInnerHTML, nên
 * nội dung do model sinh ra không thể chèn HTML vào trang.
 */

/**
 * Con trỏ nhấp nháy cuối một câu trả lời đang được model viết.
 *
 * Không phải trang trí: nội dung phía trước nó CHƯA qua guardrail và hoàn toàn có thể bị thay
 * sạch khi lượt kết thúc. Con trỏ là cách nói với khách rằng đây chưa phải câu trả lời cuối
 * cùng, nên đừng vội hành động theo nó.
 *
 * `aria-hidden` vì nó không mang thông tin đọc được; trạng thái đang chạy được khai bằng
 * `aria-busy` trên chính bong bóng tin nhắn, nơi trình đọc màn hình đọc được nó một lần.
 */
export const StreamingCursor: React.FC = () => (
  <span
    aria-hidden="true"
    className="inline-block w-[2px] h-[1em] translate-y-[2px] ml-0.5 bg-current animate-pulse motion-reduce:animate-none"
  />
);

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'divider' };

const HEADING_LINE = /^ {0,3}#{1,4}\s+(.*)$/;
const BULLET_LINE = /^\s*[-*+•]\s+(.*)$/;
const ORDERED_LINE = /^\s*\d{1,2}[.)]\s+(.*)$/;
const DIVIDER_LINE = /^\s*([-*_])\1{2,}\s*$/;

/** Capture group giữ lại chính đoạn khớp khi tách chuỗi bằng String.split. */
const INLINE_TOKEN =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/;

/** Chỉ cho phép giao thức an toàn, tránh liên kết javascript: do model sinh ra. */
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

function parseBlocks(raw: string): Block[] {
  const blocks: Block[] = [];
  let list: { kind: 'list'; ordered: boolean; items: string[] } | null = null;
  let paragraph: { kind: 'paragraph'; lines: string[] } | null = null;

  const flush = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
    if (paragraph) {
      blocks.push(paragraph);
      paragraph = null;
    }
  };

  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) {
      flush();
      continue;
    }

    if (DIVIDER_LINE.test(line)) {
      flush();
      blocks.push({ kind: 'divider' });
      continue;
    }

    const heading = HEADING_LINE.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', text: heading[1] });
      continue;
    }

    const bullet = BULLET_LINE.exec(line);
    const ordered = bullet ? null : ORDERED_LINE.exec(line);
    if (bullet || ordered) {
      if (paragraph) {
        blocks.push(paragraph);
        paragraph = null;
      }

      const isOrdered = !bullet;
      const text = (bullet || ordered)[1];

      if (list && list.ordered === isOrdered) {
        list.items.push(text);
      } else {
        if (list) blocks.push(list);
        list = { kind: 'list', ordered: isOrdered, items: [text] };
      }
      continue;
    }

    if (list) {
      blocks.push(list);
      list = null;
    }
    if (paragraph) paragraph.lines.push(line.trim());
    else paragraph = { kind: 'paragraph', lines: [line.trim()] };
  }

  flush();
  return blocks;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text
    .split(INLINE_TOKEN)
    .filter((part) => !!part)
    .map((part, index) => {
      const key = `${keyPrefix}-i${index}`;

      if (part.length > 4 && ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__')))) {
        return (
          <strong key={key} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }

      if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }

      if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={key} className="px-1 py-0.5 rounded bg-black/5 font-mono text-[0.92em]">
            {part.slice(1, -1)}
          </code>
        );
      }

      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
      if (link) {
        return SAFE_LINK.test(link[2]) ? (
          <a
            key={key}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2 hover:opacity-75"
          >
            {link[1]}
          </a>
        ) : (
          <React.Fragment key={key}>{link[1]}</React.Fragment>
        );
      }

      return <React.Fragment key={key}>{part}</React.Fragment>;
    });
}

function renderBlock(block: Block, index: number): React.ReactNode {
  const key = `b${index}`;

  if (block.kind === 'divider') {
    return <hr key={key} className="border-t border-black/10" />;
  }

  if (block.kind === 'heading') {
    return (
      <p key={key} className="font-semibold pt-1 first:pt-0">
        {renderInline(block.text, key)}
      </p>
    );
  }

  if (block.kind === 'list') {
    const items = block.items.map((item, itemIndex) => (
      <li key={`${key}-${itemIndex}`} className="marker:text-[#6e7977]">
        {renderInline(item, `${key}-${itemIndex}`)}
      </li>
    ));

    return block.ordered ? (
      <ol key={key} className="pl-5 space-y-1 list-decimal">
        {items}
      </ol>
    ) : (
      <ul key={key} className="pl-5 space-y-1 list-disc">
        {items}
      </ul>
    );
  }

  return (
    <p key={key}>
      {block.lines.map((line, lineIndex) => (
        <React.Fragment key={`${key}-l${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {renderInline(line, `${key}-l${lineIndex}`)}
        </React.Fragment>
      ))}
    </p>
  );
}

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, className = '' }) => {
  const blocks = React.useMemo(() => parseBlocks(content), [content]);

  return (
    <div className={`space-y-2 leading-relaxed ${className}`}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
};
