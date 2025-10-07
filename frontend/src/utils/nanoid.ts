const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const nanoid = (length = 12) => {
  let result = '';
  const charactersLength = alphabet.length;
  for (let i = 0; i < length; i += 1) {
    result += alphabet.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};
