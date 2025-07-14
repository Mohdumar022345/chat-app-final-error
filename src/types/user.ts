export interface UserProfile {
  id: string;
  email: string;
  username: string;
  profileImageUrl?: string;
  userPosition?: number | null; // New: Optional user position
  hasSeenConfetti?: boolean; // New: Track if user has seen confetti
}