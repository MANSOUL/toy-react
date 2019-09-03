export function arrToMap(arr) {
  let o = {};
  for (let index = 0; index < arr.length; index += 2) {
    let key = arr[index];
    let value = arr[index + 1];
    o[key] = value;
  }
  return o;
}

export function tValue(value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.join('');
  }
  return value;
}

export function temlateValue(value) {
  let regString = /^(['"]).*(\1)$/;
  let regNumber = /^\d+$/;
  if (regString.test(value)) {
    value = value.replace(/^"|"$/g, '');
  }else if (regNumber.test(value)) {
    value = Number(value);
  }
  // console.log(value);
  return value;
}