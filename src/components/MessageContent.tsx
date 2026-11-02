interface MessageContentProps {
  content: string;
}

const TRUSTED_URL = /(https:\/\/catachess\.com\/[^\s]+)/g;
const TRAILING_PUNCTUATION = /[),.!?;:]+$/;

export default function MessageContent({ content }: MessageContentProps) {
  return (
    <>
      {content.split(TRUSTED_URL).map((part, index) => {
        if (!part.startsWith('https://catachess.com/')) return part;
        const trailing = part.match(TRAILING_PUNCTUATION)?.[0] ?? '';
        const href = trailing ? part.slice(0, -trailing.length) : part;
        return (
          <span key={`${href}-${index}`}>
            <a href={href} target="_blank" rel="noopener noreferrer">Open in CataChess</a>
            {trailing}
          </span>
        );
      })}
    </>
  );
}
