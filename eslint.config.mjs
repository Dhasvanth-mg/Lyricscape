import next from 'eslint-config-next';

const config = [
  ...next,
  { ignores: ['.next/**', '.data/**', 'node_modules/**', 'public/**'] },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default config;
