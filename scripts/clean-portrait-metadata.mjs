// Remove contact-bearing metadata segments without changing compressed image data.
// Required photo credit and licensing remain in the public attribution manifest.
export function cleanPortraitMetadata(bytes){
 if(bytes[0]!==0xff||bytes[1]!==0xd8)return bytes;
 const parts=[bytes.subarray(0,2)];let offset=2;
 while(offset<bytes.length){
  const marker=bytes[offset+1];
  if(marker===0xda||marker===0xd9){parts.push(bytes.subarray(offset));break;}
  if(bytes[offset]!==0xff||offset+4>bytes.length)throw Error('Invalid JPEG marker');
  const end=offset+2+bytes.readUInt16BE(offset+2);
  if(end>bytes.length||end<=offset+3)throw Error('Invalid JPEG length');
  const metadata=(marker>=0xe1&&marker<=0xef)||marker===0xfe;
  const contact=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(bytes.subarray(offset,end).toString('latin1'));
  if(!metadata||!contact)parts.push(bytes.subarray(offset,end));
  offset=end;
 }
 return Buffer.concat(parts);
}
