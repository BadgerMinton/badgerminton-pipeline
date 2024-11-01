import os

from dotenv import load_dotenv
from github import Github

load_dotenv()


def upload_to_github(file_path: str, commit_message: str):
    # Replace with your GitHub personal access token
    token = os.getenv("GITHUB_PERSONAL_ACCESS_TOKEN", "")
    # Replace with your repository details
    repo_name = "badgerminton/badgerminton-data"
    # Authenticate with GitHub
    g = Github(token)

    # Get the repository
    repo = g.get_repo(repo_name)

    # Read the CSV file
    with open(file_path, "rb") as file:
        try:
            # Try to get the existing file
            existing_file = repo.get_contents(
                file_path
            )  # Replace with the name of the file in the repo
            print("File exists! Uploading...")

            # ignore if it is a list
            if isinstance(existing_file, list):
                return

            # Update the file
            repo.update_file(
                path=existing_file.path,
                message=commit_message,
                content=file.read(),
                sha=existing_file.sha,
                branch="main",  # Specify the branch if needed
            )
            print(f"Updated {file_path} in {repo_name}!")
        except Exception:
            print("File does not exist yet. Creating a new file...")
            # Upload the file to the repository
            repo.create_file(
                path=file_path,  # Path where the file will be stored in the repo
                message=commit_message,
                content=file.read(),
                branch="main",  # Specify the branch if needed
            )
            print(f"Created {file_path} in {repo_name}!")
