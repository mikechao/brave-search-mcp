import ReactMarkdown from 'react-markdown';

interface LocalBusinessDescriptionProps {
  description: string;
}

export default function LocalBusinessDescription({ description }: LocalBusinessDescriptionProps) {
  return <ReactMarkdown>{description}</ReactMarkdown>;
}
