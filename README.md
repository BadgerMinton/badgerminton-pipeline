# badgerminton-pipeline

Logic to clean data, compute ELO scores, and store them in [badgerminton-data](https://github.com/BadgerMinton/badgerminton-data).

## To install and run

1. Install [uv](https://docs.astral.sh/uv/):

   ```sh
   brew install uv
   ```

2. Install Python packages:

   ```sh
   uv sync
   ```

3. Create a `.env` file in the root project directory and populate it with keys in `.env.example`. Get the values in https://github.com/orgs/BadgerMinton/projects/1/views/1?pane=issue&itemId=85636931.

4. Run cells in [clean.ipynb](./clean.ipynb) to clean up data.
5. Run cells in [calculate.ipynb](./calculate.ipynb) to calculate the ELO scores.
6. Optional: Run cells in [colocate.ipynb](./colocate.ipynb) to do further exploration & analysis on the results.
