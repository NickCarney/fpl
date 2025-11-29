-- Add defensive statistics columns to players table
-- Run this migration to add clearances_blocks_interceptions, recoveries, tackles, and defensive_contribution

USE FPL;
GO

-- Check if columns already exist before adding them
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.players') AND name = 'clearances_blocks_interceptions')
BEGIN
    ALTER TABLE dbo.players ADD clearances_blocks_interceptions INT DEFAULT 0;
    PRINT 'Added clearances_blocks_interceptions column';
END
ELSE
BEGIN
    PRINT 'clearances_blocks_interceptions column already exists';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.players') AND name = 'recoveries')
BEGIN
    ALTER TABLE dbo.players ADD recoveries INT DEFAULT 0;
    PRINT 'Added recoveries column';
END
ELSE
BEGIN
    PRINT 'recoveries column already exists';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.players') AND name = 'tackles')
BEGIN
    ALTER TABLE dbo.players ADD tackles INT DEFAULT 0;
    PRINT 'Added tackles column';
END
ELSE
BEGIN
    PRINT 'tackles column already exists';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.players') AND name = 'defensive_contribution')
BEGIN
    ALTER TABLE dbo.players ADD defensive_contribution INT DEFAULT 0;
    PRINT 'Added defensive_contribution column';
END
ELSE
BEGIN
    PRINT 'defensive_contribution column already exists';
END
GO

PRINT 'Defensive stats columns migration completed successfully';
GO
