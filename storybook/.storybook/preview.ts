import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  parameters: {
    options: {
      storySort: (left, right) => {
        const order = [
          'Introduction',
          'Getting Started',
          'Playground',
          'Audio Worklet',
          'Interpolation Strategies',
          'Core',
        ];

        const leftRoot = left.title.split('/')[0];
        const rightRoot = right.title.split('/')[0];
        const leftIndex = order.indexOf(leftRoot);
        const rightIndex = order.indexOf(rightRoot);

        if (leftIndex !== -1 || rightIndex !== -1) {
          if (leftIndex === -1) {
            return 1;
          }
          if (rightIndex === -1) {
            return -1;
          }
          if (leftIndex !== rightIndex) {
            return leftIndex - rightIndex;
          }
        }

        return left.title.localeCompare(right.title);
      },
    },
  },
};

export default preview;
