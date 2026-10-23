import next from 'eslint-config-next';

const config = [
  ...next,
  { ignores: ['.next/**', '.data/**', 'node_modules/**', 'public/**', 'tools/aligner/.venv/**', 'tools/aligner/data/**'] },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default config;
