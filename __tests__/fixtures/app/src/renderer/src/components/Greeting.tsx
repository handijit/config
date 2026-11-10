import type { ReactElement } from 'react';

import { useGreeting } from '@/hooks/use-greeting.hook';

import { greeting } from '@shared/helpers/greeting.helper';

/** Greets the user, with a placeholder until main answers. */
export const Greeting = ({ name }: { name: string }): ReactElement => {
  const text = useGreeting(name);
  return <p>{text === '' ? greeting('…') : text}</p>;
};
