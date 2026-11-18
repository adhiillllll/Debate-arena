import os
import uuid
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values
from embedding_service import generate_embedding

# Load environment variables from the Next.js web directory
# Updated to look for .env instead of .env.local
ENV_PATH = Path(__file__).resolve().parent.parent / "web" / ".env"
load_dotenv(ENV_PATH)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in web/.env")

def chunk_text(text: str, chunk_size: int = 400) -> list[str]:
    """
    A simple MVP chunking strategy: splits text into roughly equal parts 
    without breaking in the middle of a sentence if possible.
    """
    sentences = text.replace('\n', ' ').split('. ')
    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= chunk_size:
            current_chunk += sentence + ". "
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + ". "
    
    if current_chunk:
        chunks.append(current_chunk.strip())
        
    return chunks

def ingest_document(title: str, url: str, content: str):
    """Processes a document, generates embeddings, and stores them in PostgreSQL."""
    
    # 1. Split the content into chunks
    chunks = chunk_text(content)
    print(f"Extracted {len(chunks)} chunks from the document.")

    source_id = str(uuid.uuid4())
    
    try:
        # Connect to the database
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # 2. Insert the Evidence Source (matching schema.prisma exactly)
        cur.execute("""
            INSERT INTO public.evidence_sources (id, title, url, "sourceType", "retrievedAt")
            VALUES (%s, %s, %s, 'RESEARCH_PAPER', NOW())
        """, (source_id, title, url))
        print(f"Inserted EvidenceSource with ID: {source_id}")

        # 3. Generate embeddings and prepare chunk records
        chunk_records = []
        for index, chunk_text_content in enumerate(chunks):
            print(f"Generating embedding for chunk {index}...")
            
            # Use RETRIEVAL_DOCUMENT as required by your embedding service
            vector = generate_embedding(chunk_text_content, "RETRIEVAL_DOCUMENT")
            chunk_id = str(uuid.uuid4())
            
            # Format the vector as a string list for Postgres to cast to vector(768)
            vector_str = f"[{','.join(map(str, vector))}]"
            
            chunk_records.append((
                chunk_id,
                source_id,
                chunk_text_content,
                index,
                vector_str
            ))

        # 4. Insert the Evidence Chunks using execute_values for efficiency
        insert_query = """
            INSERT INTO public.evidence_chunks (id, "sourceId", content, "chunkIndex", embedding)
            VALUES %s
        """
        execute_values(cur, insert_query, chunk_records)
        print(f"Successfully inserted {len(chunk_records)} chunks into evidence_chunks.")

        # Commit the transaction
        conn.commit()

    except Exception as e:
        print(f"An error occurred during ingestion: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    # Sample data for testing
    sample_title = "Renewable Energy Growth in India"
    sample_url = "https://example-energy-institute.org/india-report-2025"
    sample_content = (
        "India's renewable energy production has increased significantly over the last decade. "
        "The country has set an ambitious target of achieving 500 GW of non-fossil fuel-based energy "
        "capacity by 2030. Solar power accounts for the largest share of this growth, driven by "
        "government subsidies and favorable geographical conditions. Furthermore, wind energy capacity "
        "is expanding rapidly in coastal states like Tamil Nadu and Gujarat. The transition to renewable "
        "energy is expected to reduce India's carbon emissions by 1 billion tonnes by the end of the decade."
    )

    print("Starting ingestion test...")
    ingest_document(sample_title, sample_url, sample_content)