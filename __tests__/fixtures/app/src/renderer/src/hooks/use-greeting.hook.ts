import { useEffect, useState } from 'react';

import { desktop } from '@/services/desktop.service';

/** The greeting main sends for `name`, once it arrives. */
export const useGreeting = (name: string): string => {
  const [text, setText] = useState('');
  useEffect(() => {
    desktop()
      .greet(name)
      .then(setText)
      .catch(() => setText(''));
  }, [name]);
  return text;
};
