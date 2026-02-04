import asyncio
import os
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://kanbot:kanbot@localhost/kanbot'
os.environ['SECRET_KEY'] = 'test-secret-key-for-migration-check'
os.environ['ENCRYPTION_KEY'] = 'test-encryption-key-for-migration-check-32bytes!'

import sys
sys.path.insert(0, '/home/jk/Kanbot/backend')

from sqlalchemy import text
from app.core.database import async_session_maker

async def check_columns():
    async with async_session_maker() as session:
        result = await session.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'cards' 
            ORDER BY column_name
        """))
        columns = [row[0] for row in result.fetchall()]
        print('Columns in cards table:')
        for col in columns:
            print(f'  - {col}')
        
        # Check if created_by and created_at exist
        if 'created_by' in columns and 'created_at' in columns:
            print('\n✓ created_by and created_at columns already exist!')
            print('  No migration needed for adding columns.')
        else:
            print('\n✗ Missing columns detected!')
            if 'created_by' not in columns:
                print('  - created_by is missing')
            if 'created_at' not in columns:
                print('  - created_at is missing')

asyncio.run(check_columns())
