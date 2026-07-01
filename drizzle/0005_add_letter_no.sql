ALTER TABLE certificate_number_settings 
ADD COLUMN letter_no varchar(50) NOT NULL DEFAULT '' AFTER letter_prefix;