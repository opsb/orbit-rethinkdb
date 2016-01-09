import Schema from 'orbit-common/schema';

export default new Schema({
  models: {
    message: {
      attributes: {
        body: {type: 'string'},
        author: {type: 'string', defaultValue: null},
      },
      relationships: {
        chatRoom: {type: 'hasOne', model: 'chatRoom', inverse: 'messages'},
      },
    },
    chatRoom: {
      attributes: {
        name: {type: 'string'},
      },
      relationships: {
        messages: {type: 'hasMany', model: 'message', inverse: 'chatRoom'},
      },
    },
  },
});
