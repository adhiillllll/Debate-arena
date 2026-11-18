import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from embedding_service import generate_embedding

# Load environment variables (using .env as corrected previously)
ENV_PATH = Path(__file__).resolve().parent.parent / "web" / ".env"
load_dotenv(ENV_PATH)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in web/.env")

def test_semantic_search(claim: str):
    print(f"\nAnalyzing Claim: '{claim}'")
    print("Generating claim embedding (FACT_VERIFICATION task)...")
    
    # 1. Generate the embedding for the claim
    vector = generate_embedding(claim, "FACT_VERIFICATION")
    
    # Format vector for Postgres pgvector
    vector_str = f"[{','.join(map(str, vector))}]"
    
    try:
        # Connect to the database
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # 2. Query the match_evidence_chunks function
        print("Searching for relevant evidence in the database...")
        
        # We pass the vector, a limit of 5 matches, and a minimum similarity threshold of 0.0
        query = """
            SELECT id, "sourceId", content, "chunkIndex", similarity 
            FROM public.match_evidence_chunks(%s::vector(768), 5, 0.0)
        """
        cur.execute(query, (vector_str,))
        results = cur.fetchall()
        
        # 3. Display the results
        if not results:
            print("No matching evidence found.")
        else:
            print(f"Found {len(results)} chunks. Ranking by relevance:")
            print("-" * 60)
            for row in results:
                chunk_id, source_id, content, chunk_index, similarity = row
                print(f"Similarity Score : {similarity:.4f}")
                print(f"Source ID        : {source_id}")
                print(f"Content          : {content}")
                print("-" * 60)

    except Exception as e:
        print(f"An error occurred during retrieval: {e}")
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    # Test 1: A highly relevant claim
    claim_1 = "India plans to expand its solar and wind energy to combat climate change."
    test_semantic_search(claim_1)

    # Test 2: An unrelated claim (should have a much lower similarity score)
    claim_2 = "The latest smartphone features an improved camera and a faster processor."
    test_semantic_search(claim_2)