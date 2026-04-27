import type { Preview } from '@storybook/react-vite';
import '../../../packages/tokens/src/tokens.css';
import '../../../packages/react/src/styles.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
