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

        // Items listed here sort before all others within their group.
        const subOrder = {
          'Audio Worklet': ['Audio Worklet/Getting Started'],
        };

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

        // Same group — check sub-ordering before falling back to locale sort.
        if (leftRoot === rightRoot) {
          const pinned = subOrder[leftRoot] ?? [];
          const li = pinned.indexOf(left.title);
          const ri = pinned.indexOf(right.title);
          if (li !== -1 || ri !== -1) {
            if (li === -1) return 1;
            if (ri === -1) return -1;
            return li - ri;
          }
        }

        return left.title.localeCompare(right.title);
      },
    },
  },
};

export default preview;
