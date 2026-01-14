interface MintActionsProps {
  tokenUri?: string | null;
  conversationId?: string;
  onMint?: () => Promise<void>;
}

export default function MintActions({
  tokenUri,
  onMint,
}: MintActionsProps) {
  if (!tokenUri) {
    return null;
  }

  return (
    <div className="flex justify-center gap-3 py-4">
      <button
        onClick={onMint}
        className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Mint as NFT
      </button>
    </div>
  );
}
