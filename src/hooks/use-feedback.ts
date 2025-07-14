import { SettingsState } from '@/components/SettingsDialog';

interface UseFeedbackProps {
  userSettings: SettingsState;
}

export function useFeedback({ userSettings }: UseFeedbackProps) {
  
  const handleFeedbackSubmit = async (userPosition: string, feedbackText: string) => {
    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userPosition,
          feedbackText
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      const data = await response.json();
      console.log('✅ Feedback submitted successfully:', data);
      
    } catch (error) {
      console.error('❌ Error submitting feedback:', error);
      throw error; // Re-throw to let the dialog handle the error
    }
  };

  return {
    handleFeedbackSubmit
  };
}